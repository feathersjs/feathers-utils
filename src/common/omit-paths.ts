import type { PropertyPath } from '../types.js'
import { castPath } from './to-path.js'
import { shallowClone } from './shallow-clone.js'
import { setOwnProperty } from './set-own-property.js'

/**
 * Returns a copy of `object` without the given paths. Paths may be nested
 * (`'user.email'`), in which case the objects on the way are copied so the
 * source keeps its key; untouched branches stay shared by reference. Arrays and
 * class instances on the path are copied too — nothing here writes into what it
 * was handed.
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

  // own AND inherited enumerable keys, plus own enumerable symbols
  for (const key in object) setOwnProperty(result, key, object[key])
  for (const sym of Object.getOwnPropertySymbols(object)) {
    if (Object.prototype.propertyIsEnumerable.call(object, sym)) {
      result[sym] = object[sym]
    }
  }

  // the containers copied so far, so paths sharing a prefix copy it only once
  let copies: Set<object> | undefined

  for (const path of paths) {
    const keys = castPath(path, object)
    let parent: any = result

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const child = Object.hasOwn(parent, key) ? parent[key] : undefined
      if (child === null || typeof child !== 'object') {
        parent = undefined
        break
      }
      if (!copies?.has(child)) {
        const copy = shallowClone(child)
        ;(copies ??= new Set()).add(copy)
        setOwnProperty(parent, key, copy)
        parent = copy
      } else {
        parent = child
      }
    }

    if (parent !== undefined) delete parent[keys[keys.length - 1]]
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

    it('never writes into a class instance on the path', () => {
      class Model {
        x = 1
        y = 2
      }
      const model = new Model()
      const out = omitPaths({ m: model }, ['m.x'])

      expect(out.m).not.toBe(model)
      expect(out.m).toBeInstanceOf(Model)
      expect(out.m).toEqual({ y: 2 })
      expect(model).toEqual({ x: 1, y: 2 })
    })

    it('applies paths that share a prefix to the same copy', () => {
      const source = { u: { a: 1, b: 2, c: 3 } }
      expect(omitPaths(source, ['u.a', 'u.b'])).toEqual({ u: { c: 3 } })
      expect(source).toEqual({ u: { a: 1, b: 2, c: 3 } })
    })

    it('keeps a top-level omit shallow, so untouched branches stay shared', () => {
      const nested = { deep: 1 }
      const out = omitPaths({ a: 1, nested }, ['a'])
      expect(out.nested).toBe(nested)
    })

    it('copies only the containers on a nested path', () => {
      const other = { deep: 1 }
      const out = omitPaths({ u: { e: 'x' }, other }, ['u.e'])
      expect(out.other).toBe(other)
    })

    it('keeps a `__proto__` key a key instead of inheriting from it', () => {
      const source = JSON.parse('{"name":"a","__proto__":{"role":"admin"}}')
      const out = omitPaths(source, ['role'])

      expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
      expect(out.role).toBeUndefined()
      expect(Object.keys(out)).toStrictEqual(['name', '__proto__'])
    })

    it('does not descend through `__proto__` into Object.prototype', () => {
      omitPaths({ a: 1 }, ['__proto__.__lookupSetter__'])
      expect(typeof (Object.prototype as any).__lookupSetter__).toBe('function')
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

      // a nested path copies `nested` too, so both copies must skip the symbol
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
