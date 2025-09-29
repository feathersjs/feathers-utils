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
})
