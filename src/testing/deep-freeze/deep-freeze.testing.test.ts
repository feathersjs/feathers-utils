import { deepFreeze } from './deep-freeze.testing.js'

describe('deepFreeze', function () {
  it('freezes nested objects and arrays, and returns the value', function () {
    const params = { query: { $or: [{ age: { $gt: 18 } }] } }

    expect(deepFreeze(params)).toBe(params)
    expect(Object.isFrozen(params.query)).toBe(true)
    expect(Object.isFrozen(params.query.$or)).toBe(true)
    expect(() => {
      params.query.$or[0].age.$gt = 21
    }).toThrow(TypeError)
  })

  it('freezes what is below an object that is frozen already', function () {
    const params = Object.freeze({ query: { $limit: 10 } })

    deepFreeze(params)

    expect(Object.isFrozen(params.query)).toBe(true)
  })

  it('freezes values under symbol keys', function () {
    const gt = Symbol('gt')
    const query = { age: { [gt]: { value: 18 } } }

    deepFreeze(query)

    expect(Object.isFrozen(query.age[gt])).toBe(true)
  })

  it('handles self-references', function () {
    const params: any = { query: {} }
    params.query.params = params

    expect(() => deepFreeze(params)).not.toThrow()
    expect(Object.isFrozen(params.query)).toBe(true)
  })

  it('skips typed arrays, which can not be frozen', function () {
    const data = { file: new Uint8Array([1, 2]), meta: { name: 'a' } }

    expect(() => deepFreeze(data)).not.toThrow()
    expect(Object.isFrozen(data)).toBe(true)
    expect(Object.isFrozen(data.meta)).toBe(true)
    expect(Object.isFrozen(data.file)).toBe(false)
  })

  it('leaves primitives alone', function () {
    expect(deepFreeze(1)).toBe(1)
    expect(deepFreeze(null)).toBe(null)
    expect(deepFreeze(undefined)).toBe(undefined)
  })
})
