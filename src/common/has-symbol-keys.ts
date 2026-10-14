const isEnumerable = Object.prototype.propertyIsEnumerable

/**
 * Whether `value` has own enumerable symbol keys - sequelize uses them as
 * operators. `Object.keys` doesn't see them, so a query helper that reads it
 * must check this before treating an object as empty, as holding a single
 * property, or as holding only one operator.
 *
 * @example
 * ```ts
 * hasSymbolKeys({ a: 1 }) // => false
 * hasSymbolKeys({ [Op.or]: [{ a: 1 }] }) // => true
 * ```
 */
export const hasSymbolKeys = (value: object): boolean => {
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    if (isEnumerable.call(value, symbol)) return true
  }
  return false
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('hasSymbolKeys', () => {
    it('is true for an own enumerable symbol key', () => {
      expect(hasSymbolKeys({ [Symbol.for('or')]: [] })).toBe(true)
    })

    it('is false without symbol keys', () => {
      expect(hasSymbolKeys({ a: 1 })).toBe(false)
      expect(hasSymbolKeys({})).toBe(false)
    })

    it('ignores non-enumerable symbol keys', () => {
      const value = {}
      Object.defineProperty(value, Symbol('hidden'), {
        value: 1,
        enumerable: false,
      })
      expect(hasSymbolKeys(value)).toBe(false)
    })
  })
}
