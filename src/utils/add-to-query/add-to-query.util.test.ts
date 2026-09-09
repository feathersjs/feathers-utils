import { addToQuery } from './add-to-query.util.js'

describe('addToQuery', () => {
  it('basic usage', () => {
    const result = addToQuery({}, { id: 1 })

    expect(result).toEqual({ id: 1 })
  })

  it('adds to undefined', () => {
    const result = addToQuery(undefined as any, { id: 1 })

    expect(result).toEqual({ id: 1 })
  })

  it('adds if property not in original query', () => {
    const result = addToQuery({ name: 'John' }, { id: 1 })

    expect(result).toEqual({ name: 'John', id: 1 })
  })

  it('does not add if exact same property-value pair exists', () => {
    const result = addToQuery({ id: 1 }, { id: 1 })

    expect(result).toEqual({ id: 1 })
  })

  it('adds to $and if property exists with different value', () => {
    const result = addToQuery({ id: 1 }, { id: 2 })

    expect(result).toEqual({ id: 1, $and: [{ id: 2 }] })
  })

  it('does not add to $and if exact same property-value pair exists in $and', () => {
    const result = addToQuery({ id: 1, $and: [{ id: 2 }] }, { id: 2 })

    expect(result).toEqual({ id: 1, $and: [{ id: 2 }] })
  })

  it('adds to $and if property exists with different value and $and already exists', () => {
    const result = addToQuery({ id: 1, $and: [{ id: 2 }] }, { id: 3 })

    expect(result).toEqual({ id: 1, $and: [{ id: 2 }, { id: 3 }] })
  })

  it('adds multiple properties', () => {
    const result = addToQuery({ name: 'John' }, { id: 1, age: 30 })

    expect(result).toEqual({ name: 'John', id: 1, age: 30 })
  })

  it('does not add multiple properties if exact same property-value pairs exist', () => {
    const result = addToQuery({ id: 1, age: 30 }, { id: 1, age: 30 })

    expect(result).toEqual({ id: 1, age: 30 })
  })

  it('adds to $and if multiple properties exist with different values', () => {
    const result = addToQuery({ id: 1 }, { id: 2, age: 30 })

    expect(result).toEqual({ id: 1, $and: [{ id: 2, age: 30 }] })
  })

  it('does not add to $and if exact same multiple property-value pairs exist in $and', () => {
    const result = addToQuery(
      { id: 1, $and: [{ id: 2, age: 30 }] },
      { id: 2, age: 30 },
    )

    expect(result).toEqual({ id: 1, $and: [{ id: 2, age: 30 }] })
  })

  it('flattens a pure $and query into the existing $and instead of nesting', () => {
    const result = addToQuery(
      { $and: [{ id: 1 }, { id: 2 }] },
      { $and: [{ id: 3 }] },
    )

    expect(result).toEqual({ $and: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  })

  it('flattens and dedupes $and branches', () => {
    const result = addToQuery(
      { $and: [{ id: 1 }, { id: 2 }] },
      { $and: [{ id: 2 }, { id: 3 }] },
    )

    expect(result).toEqual({ $and: [{ id: 1 }, { id: 2 }, { id: 3 }] })
  })

  it('flattens a $and query alongside other target keys', () => {
    const result = addToQuery(
      { id: 1, $and: [{ id: 2 }] },
      { $and: [{ id: 3 }] },
    )

    expect(result).toEqual({ id: 1, $and: [{ id: 2 }, { id: 3 }] })
  })

  it('is a no-op when the added $and branches already exist', () => {
    const result = addToQuery({ $and: [{ id: 1 }] }, { $and: [{ id: 1 }] })

    expect(result).toEqual({ $and: [{ id: 1 }] })
  })

  it('intersects rather than unions two conditions on the same property', () => {
    const result = addToQuery({ something: 1 }, { something: { $in: [2] } })

    expect(result).toEqual({
      something: 1,
      $and: [{ something: { $in: [2] } }],
    })
  })

  // filters are split off and merged separately — they never land in the $and
  describe('query filters', () => {
    it('keeps a filter only one side provides', () => {
      expect(addToQuery({ id: 1 }, { $limit: 20 })).toEqual({
        id: 1,
        $limit: 20,
      })
      expect(addToQuery({ $limit: 20 }, { id: 1 })).toEqual({
        id: 1,
        $limit: 20,
      })
    })

    it('lets the added query win for $limit and $skip', () => {
      expect(addToQuery({ $limit: 10, $skip: 5 }, { $limit: 20 })).toEqual({
        $limit: 20,
        $skip: 5,
      })
      expect(addToQuery({ $skip: 5 }, { $skip: 0 })).toEqual({ $skip: 0 })
    })

    it('merges $sort key by key', () => {
      expect(addToQuery({ $sort: { a: 1 } }, { $sort: { b: -1 } })).toEqual({
        $sort: { a: 1, b: -1 },
      })
      expect(addToQuery({ $sort: { a: 1 } }, { $sort: { a: -1 } })).toEqual({
        $sort: { a: -1 },
      })
    })

    it('intersects $select', () => {
      expect(addToQuery({ $select: ['a', 'b'] }, { $select: ['b'] })).toEqual({
        $select: ['b'],
      })
      expect(addToQuery({ $select: ['a'] }, { $select: ['b'] })).toEqual({
        $select: [],
      })
      expect(addToQuery({ $select: ['a'] }, { id: 1 })).toEqual({
        id: 1,
        $select: ['a'],
      })
    })

    it('merges the body as usual alongside the filters', () => {
      expect(addToQuery({ id: 1, $limit: 10 }, { id: 2, $limit: 20 })).toEqual({
        id: 1,
        $and: [{ id: 2 }],
        $limit: 20,
      })
    })

    it('does not mutate its inputs', () => {
      const targetQuery = { id: 1, $limit: 10, $sort: { a: 1 } }
      const query = { id: 2, $limit: 20 }
      const targetSnapshot = structuredClone(targetQuery)
      const querySnapshot = structuredClone(query)

      addToQuery(targetQuery, query)

      expect(targetQuery).toEqual(targetSnapshot)
      expect(query).toEqual(querySnapshot)
    })

    it('is a no-op for an equal filter', () => {
      expect(addToQuery({ $limit: 10 }, { $limit: 10 })).toEqual({ $limit: 10 })
    })
  })

  it('merges a pure $and into a target without $and directly', () => {
    const result = addToQuery({ id: 1 }, { $and: [{ id: 2 }] })

    expect(result).toEqual({ id: 1, $and: [{ id: 2 }] })
  })
})
