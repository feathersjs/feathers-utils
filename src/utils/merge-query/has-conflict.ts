import { dequal as deepEqual } from 'dequal'

type QueryRecord = Record<string, any>

/**
 * Two query bodies conflict when they share at least one key whose values are not
 * deep-equal. Internal helper for {@link mergeQuery}.
 */
export function hasConflict(target: QueryRecord, source: QueryRecord): boolean {
  for (const key of Object.keys(target)) {
    if (key in source && !deepEqual(target[key], source[key])) {
      return true
    }
  }
  return false
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('hasConflict', () => {
    it('is false for disjoint keys', () => {
      expect(hasConflict({ a: 1 }, { b: 2 })).toBe(false)
    })

    it('is false for shared equal values', () => {
      expect(hasConflict({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('is true for shared differing values', () => {
      expect(hasConflict({ a: 1 }, { a: 2 })).toBe(true)
    })

    it('compares values deeply', () => {
      expect(hasConflict({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false)
      expect(hasConflict({ a: { x: 1 } }, { a: { x: 2 } })).toBe(true)
    })
  })
}
