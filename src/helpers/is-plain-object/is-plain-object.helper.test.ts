import { isPlainObject } from './is-plain-object.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

describe('isPlainObject', () => {
  it('is true for plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
  })

  it('is false for arrays, null and primitives', () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject('')).toBe(false)
    expect(isPlainObject(1)).toBe(false)
  })

  it('is false for class instances', () => {
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(/x/)).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects({ a: 1 }, (input) =>
      isPlainObject(input),
    )
    expect(value).toBe(true)
  })
})
