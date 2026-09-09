import { isPlainObject } from './is-plain-object.js'

/**
 * The one property a query branch constrains, as a `[property, value]` entry —
 * `undefined` when the branch is not a plain object, constrains none or several
 * properties, or its key is an operator (`$or`, `$and`, `$search`, ...) rather than
 * a property. Branches like this are the ones that can be reasoned about as a single
 * condition, e.g. to merge them with another branch on the same property.
 *
 * @example
 * ```ts
 * singleProperty({ a: 1 }) // => ['a', 1]
 * singleProperty({ a: { $in: [1] } }) // => ['a', { $in: [1] }]
 * singleProperty({ a: 1, b: 2 }) // => undefined
 * singleProperty({ $or: [{ a: 1 }] }) // => undefined
 * ```
 */
export function singleProperty(branch: unknown): [string, any] | undefined {
  if (!isPlainObject(branch)) {
    return
  }

  const keys = Object.keys(branch)
  if (keys.length !== 1 || keys[0].startsWith('$')) {
    return
  }

  return [keys[0], branch[keys[0]]]
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('singleProperty', () => {
    it('returns the entry of a single-property branch', () => {
      expect(singleProperty({ a: 1 })).toEqual(['a', 1])
      expect(singleProperty({ a: { $in: [1] } })).toEqual(['a', { $in: [1] }])
      expect(singleProperty({ a: undefined })).toEqual(['a', undefined])
    })

    it('returns undefined for none or several properties', () => {
      expect(singleProperty({})).toBeUndefined()
      expect(singleProperty({ a: 1, b: 2 })).toBeUndefined()
    })

    it('returns undefined for an operator key', () => {
      expect(singleProperty({ $or: [{ a: 1 }] })).toBeUndefined()
      expect(singleProperty({ $search: 'a' })).toBeUndefined()
    })

    it('returns undefined for non-plain-object branches', () => {
      expect(singleProperty('a')).toBeUndefined()
      expect(singleProperty(null)).toBeUndefined()
      expect(singleProperty([{ a: 1 }])).toBeUndefined()
    })
  })
}
