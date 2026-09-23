import type { PropertyPath } from '../types.js'
import { castPath, reIsIndex } from './to-path.js'
import { isPlainObject } from './is-plain-object.js'

/** Keys that would let a path write reach `Object.prototype`. */
const isUnsafeKey = (key: PropertyKey) =>
  key === '__proto__' || key === 'constructor' || key === 'prototype'

/**
 * Shallow copy of an object on a write path: the copy carries the original's own
 * enumerable properties and its prototype, so the write lands on a fresh object
 * while everything hanging off it stays shared by reference.
 */
const shallowClone = (value: any): any => {
  if (Array.isArray(value)) return value.slice()
  if (isPlainObject(value)) return { ...value }
  if (value instanceof Date) return new Date(value)
  return Object.assign(Object.create(Object.getPrototypeOf(value)), value)
}

const write = <T>(
  target: T,
  path: PropertyPath,
  value: unknown,
  copyOnWrite: boolean,
): T => {
  if (target === null || typeof target !== 'object') return target

  const keys = castPath(path, target)
  let nested: any = target

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (isUnsafeKey(key)) return target
    if (nested === null || typeof nested !== 'object') return target

    if (i === keys.length - 1) {
      nested[key] = value
      break
    }

    const current = nested[key]
    if (current !== null && typeof current === 'object') {
      if (copyOnWrite) nested[key] = shallowClone(current)
    } else {
      const nextKey = keys[i + 1]
      nested[key] =
        typeof nextKey === 'string' && reIsIndex.test(nextKey) ? [] : {}
    }
    nested = nested[key]
  }

  return target
}

/**
 * Writes `value` at `path`, copying every object on the way — the copy-on-write
 * this library relies on to leave a caller's `params` untouched.
 *
 * `target` itself IS mutated (a hook re-assigns `context.params`); everything
 * below it is replaced by a shallow copy, so untouched branches keep their
 * identity. That matters for values Feathers compares by reference, such as
 * `params.connection`, which a deep clone would break.
 *
 * Missing segments are created as an array when the next key is an integer
 * index, otherwise as a plain object.
 *
 * @example
 * ```ts
 * // params.query is copied, params.connection keeps its identity
 * setPath(context, 'params.query.userId', context.params.user.id)
 * ```
 *
 * @see {@link setPathInPlace} when the target is yours to mutate
 */
export const setPath = <T>(target: T, path: PropertyPath, value: unknown): T =>
  write(target, path, value, true)

/**
 * Writes `value` at `path`, mutating every object on the way. Use it only on a
 * value you own — a freshly built item or one a transformer was handed to
 * change; for anything reachable from a caller's `params`, use {@link setPath}.
 *
 * @example
 * ```ts
 * setPathInPlace(item, 'createdAt', new Date())
 * ```
 */
export const setPathInPlace = <T>(
  target: T,
  path: PropertyPath,
  value: unknown,
): T => write(target, path, value, false)

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('setPath', () => {
    it('writes at a nested path', () => {
      expect(setPath({}, 'a.b.c', 1)).toEqual({ a: { b: { c: 1 } } })
    })

    it('writes at a top-level key', () => {
      expect(setPath({ a: 1 }, 'b', 2)).toEqual({ a: 1, b: 2 })
    })

    it('mutates the target but copies every object below it', () => {
      const keep = { deep: 1 }
      const target = { a: { keep } }
      const before = target.a

      const out = setPath(target, 'a.b', 2)

      expect(out).toBe(target)
      expect(out.a).not.toBe(before)
      expect((out.a as any).keep).toBe(keep)
      expect(before).toEqual({ keep })
    })

    it('leaves the source untouched when the target is a fresh object', () => {
      const params = { query: { a: 1 }, user: { id: 1 } }
      const out = setPath({ ...params }, 'query.b', 2)

      expect(params.query).toEqual({ a: 1 })
      expect(out.query).toEqual({ a: 1, b: 2 })
      expect(out.user).toBe(params.user)
    })

    it('creates an array when the next key is an index', () => {
      expect(setPath({}, 'a[0].b', 1)).toEqual({ a: [{ b: 1 }] })
      expect(setPath({}, 'a.0.b', 1)).toEqual({ a: [{ b: 1 }] })
    })

    it('copies an array on the path instead of mutating it', () => {
      const items = [{ x: 1 }]
      const out = setPath({ a: items }, 'a[0].y', 2)

      expect(out.a).not.toBe(items)
      expect(items[0]).toEqual({ x: 1 })
      expect(out.a[0]).toEqual({ x: 1, y: 2 })
    })

    it('replaces a non-object on the path', () => {
      expect(setPath({ a: 5 }, 'a.b', 1)).toEqual({ a: { b: 1 } })
      expect(setPath({ a: null }, 'a.b', 1)).toEqual({ a: { b: 1 } })
    })

    it('keeps the prototype of a class instance on the path', () => {
      class User {
        id = 1
        get label() {
          return `user:${this.id}`
        }
      }
      const user = new User()
      const out = setPath({ user }, 'user.name', 'alice')

      expect(out.user).not.toBe(user)
      expect(out.user).toBeInstanceOf(User)
      expect(out.user.label).toBe('user:1')
      expect('name' in user).toBe(false)
    })

    it('keeps a Date on the path usable', () => {
      const date = new Date(0)
      const out = setPath({ date }, 'date.tag', 'x')

      expect(out.date).not.toBe(date)
      expect(out.date.getTime()).toBe(0)
    })

    it('ignores prototype-polluting paths', () => {
      const target = {}
      setPath(target, '__proto__.polluted', true)
      setPath(target, 'a.constructor.prototype.polluted', true)

      expect(({} as any).polluted).toBeUndefined()
      expect((target as any).polluted).toBeUndefined()
    })

    it('returns a non-object target unchanged', () => {
      expect(setPath(null, 'a', 1)).toBe(null)
      expect(setPath(5, 'a.b', 1)).toBe(5)
    })
  })

  describe('setPathInPlace', () => {
    it.each([
      ['a.b.c', {}, { a: { b: { c: 'V' } } }],
      ['a[0].b', {}, { a: [{ b: 'V' }] }],
      ['a.0.b', {}, { a: [{ b: 'V' }] }],
      ['a.b', { a: 5 }, { a: { b: 'V' } }],
      ['a.b', { a: null }, { a: { b: 'V' } }],
      ['list[1]', { list: [1] }, { list: [1, 'V'] }],
      ['', {}, { '': 'V' }],
    ])('writes %s', (path, target, expected) => {
      expect(setPathInPlace(target, path, 'V')).toEqual(expected)
    })

    it('writes into the objects on the path instead of copying them', () => {
      const inner = { a: 1 }
      const target = { inner }

      const out = setPathInPlace(target, 'inner.b', 2)

      expect(out).toBe(target)
      expect(out.inner).toBe(inner)
      expect(inner).toEqual({ a: 1, b: 2 })
    })

    it('prefers a key that literally contains a dot', () => {
      expect(setPathInPlace({ 'a.b': 0 }, 'a.b', 'V')).toEqual({ 'a.b': 'V' })
    })

    it('reads a segment array as one nested path', () => {
      expect(setPathInPlace({}, ['a', 'b'], 'V')).toEqual({ a: { b: 'V' } })
    })

    it('ignores prototype-polluting paths', () => {
      setPathInPlace({}, '__proto__.polluted', true)
      setPathInPlace({}, 'a.constructor.prototype.polluted', true)
      expect(({} as any).polluted).toBeUndefined()
    })

    it('returns a non-object target unchanged', () => {
      expect(setPathInPlace(null, 'a', 1)).toBe(null)
      expect(setPathInPlace(5, 'a.b', 1)).toBe(5)
    })

    it('gives up when an accessor on the path yields a non-object', () => {
      const target = {}
      Object.defineProperty(target, 'a', {
        get: () => 5,
        set: () => {},
        configurable: true,
      })

      expect(() => setPathInPlace(target, 'a.b.c', 1)).not.toThrow()
      expect((target as any).a).toBe(5)
    })
  })
}
