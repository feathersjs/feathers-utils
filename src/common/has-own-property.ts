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

/**
 * Returns `true` if `obj` has all of the given `keys` as own (non-inherited)
 * properties - the counterpart of {@link hasOwnProperty}, which needs one.
 *
 * @example
 * ```ts
 * hasAllOwnProperties({ a: 1, b: 2 }, ['a', 'b']) // => true
 * hasAllOwnProperties({ a: 1 }, new Set(['a', 'b'])) // => false
 * ```
 */
export const hasAllOwnProperties = (
  obj: Record<string, unknown>,
  keys: Iterable<string>,
): boolean => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) return false
  }
  return true
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

  describe('hasAllOwnProperties', () => {
    it('is true when all keys exist, for any iterable', () => {
      expect(hasAllOwnProperties({ a: 1, b: 2 }, ['a', 'b'])).toBe(true)
      expect(hasAllOwnProperties({ a: 1, b: 2 }, new Set(['b']))).toBe(true)
      expect(hasAllOwnProperties({ a: 1 }, [])).toBe(true)
    })

    it('is false when one is missing or inherited', () => {
      expect(hasAllOwnProperties({ a: 1 }, ['a', 'b'])).toBe(false)
      expect(hasAllOwnProperties({}, ['toString'])).toBe(false)
    })
  })
}
