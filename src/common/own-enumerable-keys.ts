/**
 * The own enumerable keys of an object, symbols included - sequelize uses
 * them as query operators.
 *
 * @example
 * ```ts
 * const gt = Symbol('gt')
 * ownEnumerableKeys({ a: 1, [gt]: 2 }) // => ['a', gt]
 * ```
 */
export const ownEnumerableKeys = (obj: object): PropertyKey[] =>
  Reflect.ownKeys(obj).filter((key) =>
    Object.prototype.propertyIsEnumerable.call(obj, key),
  )

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('ownEnumerableKeys', () => {
    it('includes symbol keys', () => {
      const gt = Symbol('gt')
      expect(ownEnumerableKeys({ a: 1, [gt]: 2 })).toStrictEqual(['a', gt])
    })

    it('leaves out non-enumerable and inherited keys', () => {
      const obj = Object.create({ inherited: 1 })
      Object.defineProperty(obj, 'hidden', { value: 1, enumerable: false })
      obj.own = 1
      expect(ownEnumerableKeys(obj)).toStrictEqual(['own'])
      expect(ownEnumerableKeys([1, 2])).toStrictEqual(['0', '1'])
    })
  })
}
