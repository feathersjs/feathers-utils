/**
 * Deep equality for the values a Feathers app passes around — data, results,
 * queries and params. Plain objects are compared by their own enumerable keys
 * in any order (symbols included - sequelize uses them as operators), arrays by
 * their elements, dates and regular expressions by value, a mongo `ObjectId`
 * (anything with `toHexString`) by its hex string, and everything else -
 * functions, class instances, maps, sets - by reference: a class instance may
 * keep its state in private fields, so equal looking instances aren't
 * necessarily equal. Self-references are fine.
 *
 * It never mistakes different values for equal, but may miss equal ones (two
 * distinct `Map`s with the same entries).
 *
 * @example
 * ```ts
 * import { isEqual } from 'feathers-utils/helpers'
 *
 * isEqual({ a: 1, b: [2] }, { b: [2], a: 1 }) // => true
 * isEqual(new Date(0), new Date(0)) // => true
 * isEqual({ name: /^a/ }, { name: /^b/ }) // => false
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/is-equal.html
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
