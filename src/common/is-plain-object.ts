/**
 * Type guard for a plain object — one whose prototype is `Object.prototype` or
 * `null`. Arrays, `null`, primitives and class instances (`Date`, `RegExp`,
 * `Map`, bson `ObjectId`, ...) are all `false`.
 *
 * @example
 * ```ts
 * isPlainObject({}) // => true
 * isPlainObject(Object.create(null)) // => true
 * isPlainObject([]) // => false
 * isPlainObject(new Date()) // => false
 * ```
 */
export const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

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
  })
}
