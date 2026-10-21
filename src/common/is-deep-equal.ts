import { ownEnumerableKeys } from './own-enumerable-keys.js'

/**
 * Whether `a` and `b` are deeply equal, to tell whether a value was written
 * into. Like `isEqual` of `feathers-utils/helpers`, but class instances are
 * compared by content as well - the same prototype, then their own enumerable
 * keys -, errors by message, and maps and sets by their entries in order: a
 * copy of the params holds copies of them, not the same instances.
 *
 * @example
 * ```ts
 * isDeepEqual(new Map([['a', 1]]), new Map([['a', 1]])) // => true
 * isEqual(new Map([['a', 1]]), new Map([['a', 1]])) // => false
 * ```
 */
export const isDeepEqual = (a: unknown, b: unknown): boolean =>
  compare(a, b, new Map())

/**
 * Whether the fields of an item keep their stored values - `data` and
 * `stored` as {@link getMergedData} returns them, compared by content with
 * {@link isDeepEqual}. Without `stored`, the fields weren't fetched, so they
 * count as changed. A class that keeps its value in `#private` fields looks
 * unchanged to it.
 *
 * @example
 * ```ts
 * for (const { data, stored } of await getMergedData(context, fields)) {
 *   if (isUnchanged(data, stored)) continue
 * }
 * ```
 */
export const isUnchanged = (data: unknown, stored: unknown): boolean =>
  stored !== undefined && isDeepEqual(data, stored)

/**
 * `comparing` holds the pairs up the stack: meeting one of them again means a
 * self-reference, which is equal as far as the rest of both values is.
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
  if (a instanceof Error && a.message !== (b as Error).message) return false
  // holes have no keys, so the length tells `new Array(2)` from `[]`
  if (Array.isArray(a) && a.length !== (b as unknown[]).length) return false

  if (comparing.get(a)?.has(b)) return true
  comparing.set(a, (comparing.get(a) ?? new Set()).add(b))

  if (a instanceof Map || a instanceof Set) {
    const entriesOfA = [...a]
    const entriesOfB = [...(b as Map<unknown, unknown> | Set<unknown>)]
    if (entriesOfA.length !== entriesOfB.length) return false
    for (let i = 0; i < entriesOfA.length; i++) {
      if (!compare(entriesOfA[i], entriesOfB[i], comparing)) return false
    }
  }

  const keys = ownEnumerableKeys(a)
  if (keys.length !== ownEnumerableKeys(b).length) return false

  for (const key of keys) {
    if (
      !Object.prototype.propertyIsEnumerable.call(b, key) ||
      !compare((a as any)[key], (b as any)[key], comparing)
    ) {
      return false
    }
  }
  return true
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  const cyclic = (value: Record<string, unknown>) => {
    const obj: any = { ...value }
    obj.self = obj
    obj.list = [obj]
    return obj
  }

  describe('isUnchanged', () => {
    class Id {
      constructor(public buffer: string) {}
    }

    it('compares data and stored by content', () => {
      expect(isUnchanged({ id: new Id('a') }, { id: new Id('a') })).toBe(true)
      expect(isUnchanged({ id: new Id('a') }, { id: new Id('b') })).toBe(false)
    })

    it('counts fields that were not fetched as changed', () => {
      expect(isUnchanged({}, undefined)).toBe(false)
    })
  })

  describe('isDeepEqual', () => {
    it('compares plain objects and arrays by content, in any key order', () => {
      expect(
        isDeepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }),
      ).toBe(true)
      expect(isDeepEqual({ a: 1 }, { a: 2 })).toBe(false)
      expect(isDeepEqual({ a: undefined }, {})).toBe(false)
      expect(isDeepEqual([1, 2], [2, 1])).toBe(false)
      expect(isDeepEqual([], {})).toBe(false)
      expect(isDeepEqual(new Array(2), [])).toBe(false)
      expect(isDeepEqual(Object.create(null), {})).toBe(false)
    })

    it('compares primitives with Object.is', () => {
      expect(isDeepEqual(NaN, NaN)).toBe(true)
      expect(isDeepEqual(0, -0)).toBe(false)
      expect(isDeepEqual(1n, 1n)).toBe(true)
      expect(isDeepEqual('1', 1)).toBe(false)
      expect(isDeepEqual(null, undefined)).toBe(false)
    })

    it('compares symbol keys', () => {
      const gt = Symbol('gt')
      expect(isDeepEqual({ [gt]: 1 }, { [gt]: 1 })).toBe(true)
      expect(isDeepEqual({ [gt]: 1 }, { [gt]: 2 })).toBe(false)
    })

    it('compares dates, regular expressions and errors by value', () => {
      expect(isDeepEqual(new Date(0), new Date(0))).toBe(true)
      expect(isDeepEqual(new Date(0), new Date(1))).toBe(false)
      expect(isDeepEqual(/a/i, /a/i)).toBe(true)
      expect(isDeepEqual(/a/, /a/i)).toBe(false)
      expect(isDeepEqual(new Error('a'), new Error('a'))).toBe(true)
      expect(isDeepEqual(new Error('a'), new Error('b'))).toBe(false)
    })

    it('compares class instances by prototype and content', () => {
      class Id {
        constructor(public hex: string) {}
      }
      expect(isDeepEqual(new Id('a'), new Id('a'))).toBe(true)
      expect(isDeepEqual(new Id('a'), new Id('b'))).toBe(false)
      expect(isDeepEqual(new Id('a'), { hex: 'a' })).toBe(false)
    })

    it('compares maps and sets by their entries, in order', () => {
      expect(
        isDeepEqual(new Map([['a', { b: 1 }]]), new Map([['a', { b: 1 }]])),
      ).toBe(true)
      expect(isDeepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
      expect(isDeepEqual(new Set([1, 2]), new Set([1, 2]))).toBe(true)
      expect(isDeepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(false)
      expect(isDeepEqual(new Set([1]), new Set([1, 2]))).toBe(false)
    })

    it('compares functions by reference', () => {
      const fn = () => true
      expect(isDeepEqual({ fn }, { fn })).toBe(true)
      expect(isDeepEqual({ fn: () => true }, { fn: () => true })).toBe(false)
    })

    it('handles self-references', () => {
      const a = cyclic({ n: 1 })
      expect(isDeepEqual(a, a)).toBe(true)
      expect(isDeepEqual(a, cyclic({ n: 1 }))).toBe(true)
      expect(isDeepEqual(a, cyclic({ n: 2 }))).toBe(false)
    })
  })
}
