import { getChanges } from './get-changes.util.js'

// keeps its value in an own field, like the `buffer` of a bson ObjectId
class ObjectId {
  constructor(public buffer: string) {}
}

describe('getChanges', () => {
  it('returns the top-level fields that differ, with both values', () => {
    expect(
      getChanges(
        { name: 'Anna', age: 30, city: 'Köln' },
        { name: 'Anna', age: 31, zip: '50667' },
      ),
    ).toEqual({
      age: { before: 30, after: 31 },
      city: { before: 'Köln', after: undefined },
      zip: { before: undefined, after: '50667' },
    })
  })

  it('returns nothing for equal items', () => {
    expect(
      getChanges(
        { tags: ['a'], meta: { b: 1 }, at: new Date(0) },
        { tags: ['a'], meta: { b: 1 }, at: new Date(0) },
      ),
    ).toEqual({})
  })

  it('compares only the given fields, nested ones included', () => {
    const before = { name: 'Anna', address: { city: 'Köln', zip: '50667' } }
    const after = { name: 'Anne', address: { city: 'Bonn', zip: '50667' } }

    expect(getChanges(before, after, ['address.city', 'address.zip'])).toEqual({
      'address.city': { before: 'Köln', after: 'Bonn' },
    })
    expect(getChanges(before, after, 'name')).toEqual({
      name: { before: 'Anna', after: 'Anne' },
    })
  })

  it('treats a missing item as one without fields', () => {
    expect(getChanges(undefined, { name: 'Anna' })).toEqual({
      name: { before: undefined, after: 'Anna' },
    })
    expect(getChanges({ name: 'Anna' }, null)).toEqual({
      name: { before: 'Anna', after: undefined },
    })
  })

  it('compares class instances like an ObjectId by content', () => {
    expect(
      getChanges(
        { userId: new ObjectId('a'), ids: [new ObjectId('b')] },
        { userId: new ObjectId('a'), ids: [new ObjectId('b')] },
      ),
    ).toEqual({})
    expect(
      getChanges({ userId: new ObjectId('a') }, { userId: new ObjectId('b') }),
    ).toHaveProperty('userId')
  })
})
