import type { PropertyPath } from '../types.js'
import { castPath, reIsIndex } from './to-path.js'

/**
 * Whether `path` resolves to an **own** property — inherited properties do not
 * count, so a key named `toString` is only reported when the object really
 * carries it.
 *
 * @example
 * ```ts
 * hasPath({ user: { id: 1 } }, 'user.id') // => true
 * hasPath({ user: { id: undefined } }, 'user.id') // => true
 * hasPath({}, 'toString') // => false
 * ```
 */
export const hasPath = (object: unknown, path: PropertyPath): boolean => {
  const keys = castPath(path, object)
  let current: any = object
  let index = -1
  let result = false
  let key: PropertyKey = ''

  while (++index < keys.length) {
    key = keys[index]
    result = current != null && Object.hasOwn(Object(current), key)
    if (!result) break
    current = current[key]
  }

  if (result || index + 1 !== keys.length) return result

  // A trailing index into an array is "present" even when the slot is a hole.
  const length = current == null ? 0 : current.length
  return (
    !!length &&
    typeof length === 'number' &&
    Array.isArray(current) &&
    typeof key === 'string' &&
    reIsIndex.test(key) &&
    Number(key) < length
  )
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('hasPath', () => {
    it('is true for an own property along the whole path', () => {
      expect(hasPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(true)
      expect(hasPath({ list: [{ x: 1 }] }, 'list[0].x')).toBe(true)
      expect(hasPath({ list: [{ x: 1 }] }, 'list.0.x')).toBe(true)
    })

    it('is true for a property that exists but is undefined', () => {
      expect(hasPath({ a: { b: undefined } }, 'a.b')).toBe(true)
    })

    it('is false when the path breaks off', () => {
      expect(hasPath({ a: { b: 2 } }, 'a.b.c')).toBe(false)
      expect(hasPath({ a: 5 }, 'a.b')).toBe(false)
      expect(hasPath({ a: null }, 'a.b')).toBe(false)
      expect(hasPath({}, 'a.b')).toBe(false)
      expect(hasPath(null, 'a')).toBe(false)
      expect(hasPath(undefined, 'a')).toBe(false)
    })

    it('ignores inherited properties', () => {
      expect(hasPath({}, 'toString')).toBe(false)
      expect(hasPath({ a: {} }, 'a.toString')).toBe(false)
      expect(hasPath(Object.create({ inherited: 1 }), 'inherited')).toBe(false)
    })

    it('checks array indices against the array length', () => {
      expect(hasPath({ list: [1, 2] }, 'list[0]')).toBe(true)
      expect(hasPath({ list: [1, 2] }, 'list[1]')).toBe(true)
      expect(hasPath({ list: [1, 2] }, 'list[2]')).toBe(false)
      expect(hasPath({ list: [] }, 'list[0]')).toBe(false)
    })

    it('finds a key that literally contains a dot', () => {
      expect(hasPath({ 'a.b': 1 }, 'a.b')).toBe(true)
    })

    it('handles the empty path and numeric keys', () => {
      expect(hasPath({}, '')).toBe(false)
      expect(hasPath({ '': 7 }, '')).toBe(true)
      expect(hasPath({ 0: 'zero' }, 0)).toBe(true)
    })
  })
}
