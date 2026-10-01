import { isPlainObject } from './is-plain-object.js'
import { ownEnumerableKeys } from './own-enumerable-keys.js'

/**
 * Whether `a` and `b` fetch the same items, as a query or params. Plain
 * objects and arrays are compared by content, dates and regular expressions by
 * value, and everything else - functions, class instances, maps, sets - by
 * reference: a class instance may keep its state in private fields, so equal
 * looking instances aren't necessarily equal. Self-references are fine.
 *
 * Never mistakes different values for equal, but may miss equal ones - which
 * costs one more fetch at most.
 *
 * @example
 * ```ts
 * isEqual({ a: 1, b: [2] }, { b: [2], a: 1 }) // => true
 * isEqual({ name: /^a/ }, { name: /^b/ }) // => false
 * ```
 */
export const isEqual = (a: unknown, b: unknown): boolean =>
  compare(a, b, new Map())

/**
 * `comparing` holds the pairs up the stack: meeting one of them again means a
 * self-reference, which is equal as far as the rest of both values is
 */
const compare = (
  a: unknown,
  b: unknown,
  comparing: Map<object, Set<object>>,
): boolean => {
  if (Object.is(a, b)) return true
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)
  ) {
    return false
  }

  if (a instanceof Date) {
    return Object.is(a.getTime(), (b as Date).getTime())
  }
  if (a instanceof RegExp) {
    return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags
  }
  if (!Array.isArray(a) && !isPlainObject(a)) return false

  if (comparing.get(a)?.has(b)) return true
  comparing.set(a, (comparing.get(a) ?? new Set()).add(b))

  const keys = ownEnumerableKeys(a)
  if (keys.length !== ownEnumerableKeys(b).length) return false

  return keys.every(
    (key) =>
      Object.prototype.propertyIsEnumerable.call(b, key) &&
      compare((a as any)[key], (b as any)[key], comparing),
  )
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  // distinct instances with the same value
  const [reA, reAAgain, reAIgnoreCase, reAIgnoreCaseAgain, reB] = [
    /a/,
    /a/,
    /a/i,
    /a/i,
    /b/,
  ]

  const cyclic = (value: Record<string, unknown>) => {
    const obj: any = { ...value }
    obj.self = obj
    obj.list = [obj]
    return obj
  }

  describe('isEqual', () => {
    it('compares plain objects and arrays by content, in any key order', () => {
      expect(
        isEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }),
      ).toBe(true)
      expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
      expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
      expect(isEqual({ a: undefined }, {})).toBe(false)
      expect(isEqual([1, 2], [2, 1])).toBe(false)
      expect(isEqual([], {})).toBe(false)
      expect(isEqual(Object.create(null), {})).toBe(false)
    })

    it('compares primitives, BigInt included', () => {
      expect(isEqual(1n, 1n)).toBe(true)
      expect(isEqual({ id: 1n }, { id: 2n })).toBe(false)
      expect(isEqual(1n, 1)).toBe(false)
      expect(isEqual(NaN, NaN)).toBe(true)
      expect(isEqual('1', 1)).toBe(false)
      expect(isEqual(null, undefined)).toBe(false)
    })

    it('compares symbol keys', () => {
      const gt = Symbol('gt')
      expect(isEqual({ [gt]: 1 }, { [gt]: 1 })).toBe(true)
      expect(isEqual({ [gt]: 1 }, { [gt]: 2 })).toBe(false)
      expect(isEqual({ [gt]: 1 }, { [Symbol('gt')]: 1 })).toBe(false)
    })

    it('compares dates and regular expressions by value', () => {
      expect(isEqual(new Date(0), new Date(0))).toBe(true)
      expect(isEqual(new Date(0), new Date(1))).toBe(false)
      expect(isEqual(new Date(0), new Date(0).toISOString())).toBe(false)
      expect(isEqual(reAIgnoreCase, reAIgnoreCaseAgain)).toBe(true)
      expect(isEqual(reA, reAAgain)).toBe(true)
      expect(isEqual(reA, reB)).toBe(false)
      expect(isEqual(reA, reAIgnoreCase)).toBe(false)
    })

    it('compares functions by reference', () => {
      const fn = () => true
      expect(isEqual({ fn }, { fn })).toBe(true)
      expect(isEqual({ fn: () => true }, { fn: () => true })).toBe(false)
    })

    it('compares class instances, maps and sets by reference', () => {
      class Id {
        #hex: string
        constructor(hex: string) {
          this.#hex = hex
        }
        toString() {
          return this.#hex
        }
      }
      const id = new Id('a')
      expect(isEqual({ id }, { id })).toBe(true)
      // look the same, but aren't
      expect(isEqual(new Id('a'), new Id('b'))).toBe(false)
      expect(isEqual(new Map(), new Map())).toBe(false)
      expect(isEqual(new Set(), new Set())).toBe(false)
    })

    it('handles self-references', () => {
      const a = cyclic({ n: 1 })
      expect(isEqual(a, a)).toBe(true)
      expect(isEqual(a, cyclic({ n: 1 }))).toBe(true)
      expect(isEqual(a, cyclic({ n: 2 }))).toBe(false)
      expect(isEqual({ a }, { a: cyclic({ n: 2 }) })).toBe(false)
    })
  })
}
