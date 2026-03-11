import { sortQueryProperties } from './sort-query-properties.util.js'

describe('sortQueryProperties', () => {
  it('sorts top-level object keys', () => {
    const result = sortQueryProperties({ b: 2, a: 1 })
    expect(Object.keys(result)).toEqual(['a', 'b'])
  })

  it('sorts nested object keys', () => {
    const result = sortQueryProperties({ name: { $gt: 'A', $lt: 'Z' } })
    expect(Object.keys(result.name)).toEqual(['$gt', '$lt'])
  })

  it('sorts $or array items', () => {
    const a = sortQueryProperties({ $or: [{ name: 'Jane' }, { name: 'John' }] })
    const b = sortQueryProperties({ $or: [{ name: 'John' }, { name: 'Jane' }] })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sorts $and array items', () => {
    const a = sortQueryProperties({
      $and: [{ age: { $gt: 18 } }, { name: 'John' }],
    })
    const b = sortQueryProperties({
      $and: [{ name: 'John' }, { age: { $gt: 18 } }],
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sorts $in array items', () => {
    const a = sortQueryProperties({
      status: { $in: ['active', 'pending', 'archived'] },
    })
    const b = sortQueryProperties({
      status: { $in: ['pending', 'archived', 'active'] },
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sorts $nin array items', () => {
    const a = sortQueryProperties({ status: { $nin: [3, 1, 2] } })
    const b = sortQueryProperties({ status: { $nin: [1, 2, 3] } })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sorts $nor array items', () => {
    const a = sortQueryProperties({ $nor: [{ a: 1 }, { b: 2 }] })
    const b = sortQueryProperties({ $nor: [{ b: 2 }, { a: 1 }] })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('sorts $not array items', () => {
    const a = sortQueryProperties({ $not: [{ a: 1 }, { b: 2 }] })
    const b = sortQueryProperties({ $not: [{ b: 2 }, { a: 1 }] })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles deeply nested $or inside $and', () => {
    const a = sortQueryProperties({
      $and: [
        { $or: [{ name: 'Jane' }, { name: 'John' }] },
        { age: { $gt: 18 } },
      ],
    })
    const b = sortQueryProperties({
      $and: [
        { age: { $gt: 18 } },
        { $or: [{ name: 'John' }, { name: 'Jane' }] },
      ],
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('preserves non-operator arrays as-is', () => {
    const result = sortQueryProperties({ tags: ['b', 'a', 'c'] })
    expect(result.tags).toEqual(['b', 'a', 'c'])
  })

  it('handles combined key order and operator sorting', () => {
    const a = sortQueryProperties({
      z: 1,
      a: 2,
      $or: [{ name: 'Jane' }, { name: 'John' }],
    })
    const b = sortQueryProperties({
      $or: [{ name: 'John' }, { name: 'Jane' }],
      a: 2,
      z: 1,
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles empty query', () => {
    expect(sortQueryProperties({})).toEqual({})
  })

  it('handles primitive values', () => {
    const result = sortQueryProperties({ name: 'John', age: 30 })
    expect(result).toEqual({ age: 30, name: 'John' })
  })
})
