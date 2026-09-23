import type { PropertyPath } from '../types.js'
import { castPath } from './to-path.js'

/**
 * Reads the value at `path`, returning `defaultValue` when the path does not
 * resolve. Descending stops at `null`/`undefined` instead of throwing.
 *
 * @example
 * ```ts
 * getPath({ user: { id: 1 } }, 'user.id') // => 1
 * getPath({ user: null }, 'user.id', 0) // => 0
 * ```
 */
export const getPath = <T = any>(
  object: unknown,
  path: PropertyPath,
  defaultValue?: T,
): T => {
  if (object == null) return defaultValue as T

  const keys = castPath(path, object)
  let current: any = object
  let index = 0

  while (current != null && index < keys.length) {
    current = current[keys[index++]]
  }

  const result = index > 0 && index === keys.length ? current : undefined

  return (result === undefined ? defaultValue : result) as T
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('getPath', () => {
    it('reads a nested value', () => {
      expect(getPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1)
      expect(getPath({ user: { id: 1 } }, 'user.id')).toBe(1)
    })

    it('reads through arrays, in both notations', () => {
      expect(getPath({ list: [{ x: 1 }] }, 'list[0].x')).toBe(1)
      expect(getPath({ list: [{ x: 1 }] }, 'list.0.x')).toBe(1)
      expect(getPath({ list: [{ x: 1 }] }, ['list', 0, 'x'])).toBe(1)
    })

    it('stops at a missing or non-object segment instead of throwing', () => {
      expect(getPath({ a: { b: 2 } }, 'a.b.c')).toBeUndefined()
      expect(getPath({ a: 5 }, 'a.b')).toBeUndefined()
      expect(getPath({ a: null }, 'a.b')).toBeUndefined()
      expect(getPath({}, 'a.b.c')).toBeUndefined()
    })

    it('falls back to the default whenever the result is undefined', () => {
      expect(getPath({ a: { b: 2 } }, 'a.b.c', 'DEF')).toBe('DEF')
      expect(getPath({ a: 5 }, 'a.b', 'DEF')).toBe('DEF')
      expect(getPath({ a: null }, 'a.b', 'DEF')).toBe('DEF')
      expect(getPath(null, 'a', 'DEF')).toBe('DEF')
      expect(getPath(undefined, 'a', 'DEF')).toBe('DEF')
    })

    it('uses the default for a present-but-undefined value', () => {
      expect(getPath({ a: { b: undefined } }, 'a.b', 'DEF')).toBe('DEF')
    })

    it('does not use the default for a falsy value', () => {
      expect(getPath({ a: 0 }, 'a', 'DEF')).toBe(0)
      expect(getPath({ a: null }, 'a', 'DEF')).toBe(null)
      expect(getPath({ a: false }, 'a', 'DEF')).toBe(false)
    })

    it('prefers a key that literally contains a dot', () => {
      expect(getPath({ 'a.b': 1 }, 'a.b')).toBe(1)
      expect(getPath({ a: { b: 1 }, 'a.b': 9 }, 'a.b')).toBe(9)
    })

    it('handles the empty path and numeric keys', () => {
      expect(getPath({}, '')).toBeUndefined()
      expect(getPath({ '': 7 }, '')).toBe(7)
      expect(getPath({ 0: 'zero' }, 0)).toBe('zero')
    })
  })
}
