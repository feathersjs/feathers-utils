import type { PropertyPath } from '../types.js'
import { castPath } from './to-path.js'
import { isPlainObject } from './is-plain-object.js'

/**
 * Deep-copies plain objects and arrays, keeping everything else (`Date`, class
 * instances, ...) by reference — just enough isolation for a nested `omit` to
 * delete a key without reaching into the source.
 *
 * Arrays are copied on purpose: lodash's `omit` keeps them by reference, so
 * omitting a path that runs through one (`'list[0].x'`) deletes the key from the
 * caller's array. Nothing here may write into what it was handed.
 */
const copyPlain = (value: any): any => {
  if (Array.isArray(value)) return value.map(copyPlain)
  if (!isPlainObject(value)) return value
  const out: Record<PropertyKey, any> = {}
  for (const key of Reflect.ownKeys(value)) {
    if (!Object.prototype.propertyIsEnumerable.call(value, key)) continue
    out[key] = copyPlain((value as Record<PropertyKey, any>)[key])
  }
  return out
}

/**
 * Returns a copy of `object` without the given paths. Paths may be nested
 * (`'user.email'`), in which case the objects on the way are copied so the
 * source keeps its key.
 *
 * Each entry of `paths` is one path, and a segment array is one nested path —
 * the same reading as in `getPath`/`hasPath`/`setPath`.
 *
 * @example
 * ```ts
 * omitPaths({ id: 1, user: { email: 'a@b.c', name: 'a' } }, ['user.email'])
 * // => { id: 1, user: { name: 'a' } }
 * ```
 */
export const omitPaths = <T extends Record<PropertyKey, any>>(
  object: T | null | undefined,
  paths: readonly PropertyPath[],
): Partial<T> => {
  const result: Record<PropertyKey, any> = {}
  if (object == null) return result as Partial<T>

  const keyPaths = paths.map((path) => castPath(path, object))
  const isDeep = keyPaths.some((keys) => keys.length > 1)

  // own AND inherited enumerable keys, plus own enumerable symbols
  for (const key in object) result[key] = object[key]
  for (const sym of Object.getOwnPropertySymbols(object)) {
    if (Object.prototype.propertyIsEnumerable.call(object, sym)) {
      result[sym] = object[sym]
    }
  }

  if (isDeep) {
    for (const key of Reflect.ownKeys(result)) {
      result[key] = copyPlain(result[key])
    }
  }

  for (const keys of keyPaths) {
    let parent: any = result
    for (let i = 0; i < keys.length - 1 && parent != null; i++) {
      parent = parent[keys[i]]
    }
    if (parent != null && typeof parent === 'object') {
      delete parent[keys[keys.length - 1]]
    }
  }

  return result as Partial<T>
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('omitPaths', () => {
    it('omits top-level keys', () => {
      expect(omitPaths({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 })
    })

    it('omits a nested path', () => {
      expect(omitPaths({ id: 1, u: { e: 'x', n: 'y' } }, ['u.e'])).toEqual({
        id: 1,
        u: { n: 'y' },
      })
      expect(omitPaths({ a: { b: { c: 1 } } }, ['a.b.c'])).toEqual({
        a: { b: {} },
      })
    })

    it('omits through an array', () => {
      expect(omitPaths({ list: [{ x: 1 }, { y: 2 }] }, ['list[0].x'])).toEqual({
        list: [{}, { y: 2 }],
      })
    })

    it('keeps everything when a path does not resolve', () => {
      expect(omitPaths({ a: 1 }, ['missing'])).toEqual({ a: 1 })
      expect(omitPaths({ a: { b: 1 } }, ['a.missing.deep'])).toEqual({
        a: { b: 1 },
      })
      expect(omitPaths({ a: 1 }, [])).toEqual({ a: 1 })
    })

    it('reads a segment array as one nested path', () => {
      expect(omitPaths({ a: { b: 1, c: 2 } }, [['a', 'b']])).toEqual({
        a: { c: 2 },
      })
    })

    it('never writes into the source — nested paths included', () => {
      const source = { id: 1, user: { email: 'a@b.c', name: 'a' } }
      expect(omitPaths(source, ['user.email'])).toEqual({
        id: 1,
        user: { name: 'a' },
      })
      expect(source).toEqual({ id: 1, user: { email: 'a@b.c', name: 'a' } })
    })

    it('never writes into a source array', () => {
      const source = { list: [{ x: 1 }, { y: 2 }] }
      omitPaths(source, ['list[0].x'])
      expect(source).toEqual({ list: [{ x: 1 }, { y: 2 }] })
    })

    it('keeps a top-level omit shallow, so untouched branches stay shared', () => {
      const nested = { deep: 1 }
      const out = omitPaths({ a: 1, nested }, ['a'])
      expect(out.nested).toBe(nested)
    })

    it('copies own enumerable symbols', () => {
      const sym = Symbol('s')
      const out = omitPaths({ a: 1, [sym]: 2 }, ['a'])
      expect(out[sym]).toBe(2)
    })

    it('leaves non-enumerable symbols behind', () => {
      const hidden = Symbol('hidden')
      const source = { a: 1, nested: { b: 2 } }
      Object.defineProperty(source, hidden, { value: 3, enumerable: false })
      Object.defineProperty(source.nested, hidden, {
        value: 4,
        enumerable: false,
      })

      // a nested path forces the deep copy, so both loops see the symbol
      const out = omitPaths(source, ['nested.b'])

      expect(hidden in out).toBe(false)
      expect(hidden in (out.nested as object)).toBe(false)
    })

    it('returns an empty object for a nullish input', () => {
      expect(omitPaths(null, ['a'])).toEqual({})
      expect(omitPaths(undefined, ['a'])).toEqual({})
    })
  })
}
