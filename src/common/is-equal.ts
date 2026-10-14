/**
 * Whether `a` and `b` fetch the same items, as a query or params. Plain
 * objects are compared by their own enumerable keys (symbols included -
 * sequelize uses them as operators), arrays by their elements, dates and
 * regular expressions by value, a mongo `ObjectId` (anything with
 * `toHexString`) by its hex string, and everything else - functions, class
 * instances, maps, sets - by reference: a class instance may keep its state in
 * private fields, so equal looking instances aren't necessarily equal.
 * Self-references are fine.
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
  compare(a, b, undefined)

const isEnumerable = Object.prototype.propertyIsEnumerable

/**
 * The pairs being compared up the stack: meeting one of them again means a
 * self-reference, which is equal as far as the rest of both values is.
 * Allocated with the first pair of objects, so comparing primitives costs none.
 */
type Stack = { a: object[]; b: object[] }

const compare = (a: unknown, b: unknown, stack: Stack | undefined): boolean => {
  if (Object.is(a, b)) return true
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  const proto = Object.getPrototypeOf(a)
  if (proto !== Object.getPrototypeOf(b)) return false

  const isArray = Array.isArray(a)
  if (!isArray && proto !== Object.prototype && proto !== null) {
    if (a instanceof Date) {
      return Object.is(a.getTime(), (b as Date).getTime())
    }
    if (a instanceof RegExp) {
      return (
        a.source === (b as RegExp).source && a.flags === (b as RegExp).flags
      )
    }
    // same prototype, so `b` has it too; bson 4 keeps the id in a symbol key
    if (typeof (a as any).toHexString === 'function') {
      return (a as any).toHexString() === (b as any).toHexString()
    }
    return false
  }

  if (stack) {
    for (let i = stack.a.length - 1; i >= 0; i--) {
      if (stack.a[i] === a && stack.b[i] === b) return true
    }
  } else {
    stack = { a: [], b: [] }
  }

  stack.a.push(a)
  stack.b.push(b)
  const equal = isArray
    ? compareArrays(a as unknown[], b as unknown[], stack)
    : compareObjects(a, b, stack)
  stack.a.pop()
  stack.b.pop()
  return equal
}

/** By their elements; a hole only equals a hole. */
const compareArrays = (a: unknown[], b: unknown[], stack: Stack): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined && y === undefined) {
      if (i in a !== i in b) return false
    } else if (!compare(x, y, stack)) {
      return false
    }
  }
  return true
}

/** By their own enumerable keys, symbols included. */
const compareObjects = (a: any, b: any, stack: Stack): boolean => {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  for (const key of keys) {
    if (!isEnumerable.call(b, key) || !compare(a[key], b[key], stack)) {
      return false
    }
  }

  const symbolsA = Object.getOwnPropertySymbols(a)
  const symbolsB = Object.getOwnPropertySymbols(b)
  if (!symbolsA.length && !symbolsB.length) return true

  let unmatched = 0
  for (const symbol of symbolsA) {
    if (!isEnumerable.call(a, symbol)) continue
    unmatched++
    if (
      !isEnumerable.call(b, symbol) ||
      !compare(a[symbol], b[symbol], stack)
    ) {
      return false
    }
  }
  for (const symbol of symbolsB) {
    if (isEnumerable.call(b, symbol)) unmatched--
  }
  return unmatched === 0
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

    it('compares ObjectIds by their hex string', () => {
      // like bson 4: the id lives in a symbol key, no enumerable key is left
      const kId = Symbol('id')
      class ObjectId {
        [kId]: string
        constructor(hex: string) {
          this[kId] = hex
        }
        toHexString() {
          return this[kId]
        }
      }

      expect(isEqual(new ObjectId('a1'), new ObjectId('a1'))).toBe(true)
      expect(isEqual(new ObjectId('a1'), new ObjectId('b2'))).toBe(false)
      expect(
        isEqual({ id: new ObjectId('a1') }, { id: new ObjectId('a1') }),
      ).toBe(true)
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
