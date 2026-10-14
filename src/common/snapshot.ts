import { isEqual } from './is-equal.js'
import { isPlainObject } from './is-plain-object.js'
import { ownEnumerableKeys } from './own-enumerable-keys.js'
import { setOwnProperty } from './set-own-property.js'

/**
 * A copy of `value` that doesn't change along with it, to compare it with
 * `isEqual` later: plain objects and arrays are copied, everything else is
 * compared by reference anyway and kept. Self-references are fine.
 *
 * @example
 * ```ts
 * const query = { id: { $in: [1] } }
 * const copy = snapshot(query)
 * query.id.$in.push(2)
 * isEqual(copy, query) // => false
 * ```
 */
export const snapshot = <T>(value: T): T => copy(value, new Map())

const copy = <T>(value: T, copies: Map<object, unknown>): T => {
  if (!Array.isArray(value) && !isPlainObject(value)) return value
  const seen = copies.get(value)
  if (seen) return seen as T

  const result = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  copies.set(value, result)

  for (const key of ownEnumerableKeys(value)) {
    // a `__proto__` key stays a key
    setOwnProperty(result, key, copy((value as any)[key], copies))
  }

  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  const re = /b/

  const cyclic = (value: Record<string, unknown>) => {
    const obj: any = { ...value }
    obj.self = obj
    obj.list = [obj]
    return obj
  }

  describe('snapshot', () => {
    it('is equal to the value', () => {
      const fn = () => true
      const value = { a: [1, { b: re, d: new Date(0) }], fn, id: 1n }
      expect(isEqual(snapshot(value), value)).toBe(true)
    })

    it("doesn't change along with the value", () => {
      const value = { a: { $in: [1] } }
      const copy = snapshot(value)
      value.a.$in.push(2)
      expect(isEqual(copy, value)).toBe(false)
      expect(copy).toStrictEqual({ a: { $in: [1] } })
    })

    it('keeps everything but plain objects and arrays', () => {
      const fn = () => true
      const date = new Date(0)
      const map = new Map()
      const copy = snapshot({ fn, date, map })
      expect(copy.fn).toBe(fn)
      expect(copy.date).toBe(date)
      expect(copy.map).toBe(map)
    })

    it('copies self-references', () => {
      const value = cyclic({ n: 1 })
      const copy = snapshot(value)
      expect(copy).not.toBe(value)
      expect(copy.self).toBe(copy)
      expect(copy.list[0]).toBe(copy)
      expect(isEqual(copy, value)).toBe(true)
    })

    it('copies symbol keys and keeps a `__proto__` key a key', () => {
      const gt = Symbol('gt')
      const value = JSON.parse('{"__proto__": {"a": 1}}')
      value[gt] = 1
      const copy = snapshot(value)
      expect(Object.getPrototypeOf(copy)).toBe(Object.prototype)
      expect(copy[gt]).toBe(1)
      expect(isEqual(copy, value)).toBe(true)
    })
  })
}
