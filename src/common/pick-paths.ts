import type { PropertyPath } from '../types.js'
import { castPath } from './to-path.js'
import { getPath } from './get-path.js'
import { setPathInPlace } from './set-path.js'

/** Whether `path` resolves at all, inherited properties included (`in`). */
const hasIn = (object: unknown, keys: PropertyKey[]): boolean => {
  let current: any = object
  for (const key of keys) {
    if (current == null || !(key in Object(current))) return false
    current = current[key]
  }
  return keys.length > 0
}

/**
 * Returns an object holding only the given paths of `object`. Paths may be
 * nested (`'user.email'`), in which case the result is nested the same way.
 *
 * Each entry of `paths` is one path, and a segment array is one nested path —
 * the same reading as in `getPath`/`hasPath`/`setPath`.
 *
 * @example
 * ```ts
 * pickPaths({ id: 1, user: { email: 'a@b.c', name: 'a' } }, ['user.email'])
 * // => { user: { email: 'a@b.c' } }
 * ```
 */
export const pickPaths = <T extends Record<PropertyKey, any>>(
  object: T | null | undefined,
  paths: readonly PropertyPath[],
): Partial<T> => {
  const result: Record<PropertyKey, any> = {}
  if (object == null) return result as Partial<T>

  for (const path of paths) {
    const keys = castPath(path, object)
    if (hasIn(object, keys)) {
      setPathInPlace(
        result,
        keys as PropertyKey[] as PropertyPath,
        getPath(object, keys),
      )
    }
  }

  return result as Partial<T>
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('pickPaths', () => {
    it('picks top-level keys', () => {
      expect(pickPaths({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({
        a: 1,
        c: 3,
      })
    })

    it('picks a nested path into a nested result', () => {
      expect(pickPaths({ id: 1, u: { e: 'x', n: 'y' } }, ['u.e'])).toEqual({
        u: { e: 'x' },
      })
      expect(pickPaths({ a: { b: { c: 1 } } }, ['a.b.c'])).toEqual({
        a: { b: { c: 1 } },
      })
    })

    it('rebuilds an array when the path runs through one', () => {
      expect(pickPaths({ list: [{ x: 1 }] }, ['list[0].x'])).toEqual({
        list: [{ x: 1 }],
      })
    })

    it('skips paths that do not resolve', () => {
      expect(pickPaths({ a: 1 }, ['missing'])).toEqual({})
      expect(pickPaths({ a: 1 }, ['a.b'])).toEqual({})
      expect(pickPaths({ a: 1 }, [])).toEqual({})
    })

    it('keeps a key whose value is undefined', () => {
      expect('a' in pickPaths({ a: undefined }, ['a'])).toBe(true)
    })

    it('reads a segment array as one nested path', () => {
      expect(pickPaths({ a: { b: 1, c: 2 } }, [['a', 'b']])).toEqual({
        a: { b: 1 },
      })
    })

    it('never writes into the source', () => {
      const source = { id: 1, user: { email: 'a@b.c', name: 'a' } }
      pickPaths(source, ['user.email'])
      expect(source).toEqual({ id: 1, user: { email: 'a@b.c', name: 'a' } })
    })

    it('returns an empty object for a nullish input', () => {
      expect(pickPaths(null, ['a'])).toEqual({})
      expect(pickPaths(undefined, ['a'])).toEqual({})
    })
  })
}
