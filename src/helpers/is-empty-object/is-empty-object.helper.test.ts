import { isEmptyObject } from './is-empty-object.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

describe('isEmptyObject', () => {
  it('is true only for a plain empty object', () => {
    expect(isEmptyObject({})).toBe(true)
  })

  it('is false for a non-empty object', () => {
    expect(isEmptyObject({ a: 1 })).toBe(false)
  })

  it('is false for an object with only symbol keys', () => {
    expect(isEmptyObject({ [Symbol.for('or')]: [] })).toBe(false)
  })

  it('is false for arrays, null, undefined and primitives', () => {
    expect(isEmptyObject([])).toBe(false)
    expect(isEmptyObject(null)).toBe(false)
    expect(isEmptyObject(undefined)).toBe(false)
    expect(isEmptyObject('')).toBe(false)
    expect(isEmptyObject(0)).toBe(false)
  })

  it('is false for class instances without own keys', () => {
    class Empty {}
    expect(isEmptyObject(new Date())).toBe(false)
    expect(isEmptyObject(/x/)).toBe(false)
    expect(isEmptyObject(new Map())).toBe(false)
    expect(isEmptyObject(new Empty())).toBe(false)
  })

  it('is true for an empty object without prototype', () => {
    expect(isEmptyObject(Object.create(null))).toBe(true)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects({}, (input) => isEmptyObject(input))
    expect(value).toBe(true)
  })
})
