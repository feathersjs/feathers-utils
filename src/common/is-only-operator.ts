import { isPlainObject } from './is-plain-object.js'

/**
 * Whether a query value constrains its property with exactly this one operator:
 * `{ $in: [1] }` is only `$in`, while `{ $in: [1], $ne: 2 }` and `{ $gt: 1 }` are not.
 * Rewriting a query value is only safe once nothing else is attached to it, so this
 * is the guard in front of any such rewrite. Also answers the same question for a
 * whole query body, e.g. whether it is nothing but `{ $or: [...] }`.
 *
 * @example
 * ```ts
 * isOnlyOperator({ $in: [1] }, '$in') // => true
 * isOnlyOperator({ $in: [1], $ne: 2 }, '$in') // => false
 * isOnlyOperator(1, '$in') // => false
 * ```
 */
export function isOnlyOperator(value: unknown, operator: string): boolean {
  if (!isPlainObject(value)) {
    return false
  }
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === operator
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('isOnlyOperator', () => {
    it('is true for a value with just that operator', () => {
      expect(isOnlyOperator({ $in: [1] }, '$in')).toBe(true)
      expect(isOnlyOperator({ $or: [{ a: 1 }] }, '$or')).toBe(true)
    })

    it('is false when another operator is attached', () => {
      expect(isOnlyOperator({ $in: [1], $ne: 2 }, '$in')).toBe(false)
    })

    it('is false for a different operator', () => {
      expect(isOnlyOperator({ $nin: [1] }, '$in')).toBe(false)
    })

    it('is false for an empty object', () => {
      expect(isOnlyOperator({}, '$in')).toBe(false)
    })

    it('is false for non-plain-object values', () => {
      expect(isOnlyOperator(1, '$in')).toBe(false)
      expect(isOnlyOperator(null, '$in')).toBe(false)
      expect(isOnlyOperator(undefined, '$in')).toBe(false)
      expect(isOnlyOperator([{ $in: [1] }], '$in')).toBe(false)
      expect(isOnlyOperator(new Date(), '$in')).toBe(false)
    })
  })
}
