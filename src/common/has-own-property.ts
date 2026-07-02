/**
 * Returns `true` if `obj` has at least one of the given `keys` as an own
 * (non-inherited) property.
 *
 * @example
 * ```ts
 * hasOwnProperty({ a: 1 }, 'a') // => true
 * hasOwnProperty({ a: 1 }, 'b', 'a') // => true
 * hasOwnProperty({ a: 1 }, 'b') // => false
 * ```
 */
export const hasOwnProperty = (
  obj: Record<string, unknown>,
  ...keys: string[]
): boolean => {
  return keys.some((x) => Object.prototype.hasOwnProperty.call(obj, x))
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('hasOwnProperty', () => {
    it('is true when an own key exists', () => {
      expect(hasOwnProperty({ a: 1 }, 'a')).toBe(true)
    })

    it('is true when any of the given keys exists', () => {
      expect(hasOwnProperty({ a: 1 }, 'b', 'a')).toBe(true)
    })

    it('is false when none of the keys exist', () => {
      expect(hasOwnProperty({ a: 1 }, 'b', 'c')).toBe(false)
    })

    it('ignores inherited properties', () => {
      expect(hasOwnProperty({}, 'toString')).toBe(false)
    })
  })
}
