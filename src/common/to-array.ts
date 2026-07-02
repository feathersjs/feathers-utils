/**
 * Normalizes a value or array into an array. The returned array MUST be treated
 * as read-only — when the input is already an array it is returned as-is (no copy)
 * to avoid a per-call allocation on hook hot paths.
 *
 * @example
 * ```ts
 * toArray(1) // => [1]
 * toArray([1, 2]) // => [1, 2] (same reference)
 * ```
 */
export const toArray = <T>(value: T | readonly T[]): T[] =>
  Array.isArray(value) ? (value as T[]) : [value as T]

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('toArray', () => {
    it('wraps a non-array value in an array', () => {
      expect(toArray(1)).toEqual([1])
      expect(toArray('a')).toEqual(['a'])
    })

    it('returns an array as-is (same reference, no copy)', () => {
      const input = [1, 2]
      expect(toArray(input)).toBe(input)
    })
  })
}
