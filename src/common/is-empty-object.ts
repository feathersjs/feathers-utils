import { hasSymbolKeys } from './has-symbol-keys.js'

/**
 * Returns `true` only for a plain empty object (`{}`). Arrays, `null`, primitives
 * and non-empty objects are all `false` - an object with only symbol keys
 * (sequelize's operators) included.
 *
 * @example
 * ```ts
 * isEmptyObject({}) // => true
 * isEmptyObject({ a: 1 }) // => false
 * isEmptyObject([]) // => false
 * ```
 */
export const isEmptyObject = (obj: unknown): boolean =>
  !!obj &&
  typeof obj === 'object' &&
  !Array.isArray(obj) &&
  Object.keys(obj).length === 0 &&
  !hasSymbolKeys(obj)

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('isEmptyObject', () => {
    it('is true only for a plain empty object', () => {
      expect(isEmptyObject({})).toBe(true)
    })

    it('is false for a non-empty object', () => {
      expect(isEmptyObject({ a: 1 })).toBe(false)
    })

    it('is false for an object with only symbol keys', () => {
      expect(isEmptyObject({ [Symbol.for('or')]: [] })).toBe(false)
    })

    it('is false for arrays, null, undefined and primitives', () => {
      expect(isEmptyObject([])).toBe(false)
      expect(isEmptyObject(null)).toBe(false)
      expect(isEmptyObject(undefined)).toBe(false)
      expect(isEmptyObject('')).toBe(false)
      expect(isEmptyObject(0)).toBe(false)
    })
  })
}
