import { isPlainObject } from '../helpers/is-plain-object/is-plain-object.helper.js'

/**
 * Shallow copy of an object on a write path: the copy carries the original's own
 * enumerable properties and its prototype, so the write lands on a fresh object
 * while everything hanging off it stays shared by reference.
 *
 * @example
 * ```ts
 * const copy = shallowClone(user) // same prototype, same nested references
 * ```
 */
export const shallowClone = (value: any): any => {
  if (Array.isArray(value)) return value.slice()
  if (isPlainObject(value)) return { ...value }
  if (value instanceof Date) return new Date(value)
  return Object.assign(Object.create(Object.getPrototypeOf(value)), value)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('shallowClone', () => {
    it('copies a plain object and keeps nested references', () => {
      const nested = { b: 1 }
      const value = { a: nested }
      const out = shallowClone(value)

      expect(out).not.toBe(value)
      expect(out.a).toBe(nested)
    })

    it('copies an array', () => {
      const value = [{ a: 1 }]
      const out = shallowClone(value)

      expect(out).not.toBe(value)
      expect(out[0]).toBe(value[0])
    })

    it('keeps the prototype of a class instance', () => {
      class User {
        id = 1
      }
      const out = shallowClone(new User())

      expect(out).toBeInstanceOf(User)
      expect(out.id).toBe(1)
    })

    it('keeps a Date usable', () => {
      const out = shallowClone(new Date(0))

      expect(out).toBeInstanceOf(Date)
      expect(out.getTime()).toBe(0)
    })

    it('keeps a `__proto__` key of a plain object a key', () => {
      const out = shallowClone(JSON.parse('{"__proto__": {"a": 1}}'))

      expect(Object.keys(out)).toStrictEqual(['__proto__'])
      expect(out.a).toBeUndefined()
    })
  })
}
