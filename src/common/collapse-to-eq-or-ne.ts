import { isOnlyOperator } from './is-only-operator.js'

/**
 * Rewrites a single-value `$in`/`$nin` query value to the plain condition it already
 * is: `{ $in: [x] }` becomes `x` and `{ $nin: [x] }` becomes `{ $ne: x }` — the inverse
 * of what `eqOrIn` and `neOrNin` produce.
 *
 * The value is returned untouched when the operator is not the only one on it
 * (`{ $in: [1], $ne: 2 }` stays), when it does not hold exactly one value, or when that
 * one value is an array: `{ a: ['x'] }` means the property *is* that array, while
 * `{ a: { $in: [['x']] } }` may also be satisfied element-wise, so the two are not
 * interchangeable.
 *
 * @example
 * ```ts
 * collapseToEqOrNe({ $in: [1] }) // => 1
 * collapseToEqOrNe({ $nin: [1] }) // => { $ne: 1 }
 * collapseToEqOrNe({ $in: [1, 2] }) // => { $in: [1, 2] }
 * collapseToEqOrNe({ $in: [] }) // => { $in: [] }
 * collapseToEqOrNe({ $in: [['x']] }) // => { $in: [['x']] }
 * collapseToEqOrNe(1) // => 1
 * ```
 *
 * @internal shared by `simplifyQuery` and the `$or` collapse.
 */
export function collapseToEqOrNe(value: unknown): unknown {
  const single = singleValueOf(value, '$in')
  if (single) {
    return single.value
  }

  const negated = singleValueOf(value, '$nin')
  if (negated) {
    return { $ne: negated.value }
  }

  return value
}

/**
 * The one value a list operator matches against, wrapped so that a legitimate
 * `undefined` stays distinguishable from "does not apply".
 */
function singleValueOf(
  value: unknown,
  operator: '$in' | '$nin',
): { value: unknown } | undefined {
  if (!isOnlyOperator(value, operator)) {
    return
  }

  const values = (value as Record<string, unknown>)[operator]
  // an array value only ever survives inside the list operator it came from
  if (
    !Array.isArray(values) ||
    values.length !== 1 ||
    Array.isArray(values[0])
  ) {
    return
  }

  return { value: values[0] }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('collapseToEqOrNe', () => {
    it('collapses a single-value $in to an equality', () => {
      expect(collapseToEqOrNe({ $in: [1] })).toBe(1)
      expect(collapseToEqOrNe({ $in: [null] })).toBe(null)
      expect(collapseToEqOrNe({ $in: [new Date(5)] })).toEqual(new Date(5))
      expect(collapseToEqOrNe({ $in: [{ id: 1 }] })).toEqual({ id: 1 })
    })

    it('collapses a single-value $nin to a $ne', () => {
      expect(collapseToEqOrNe({ $nin: [1] })).toEqual({ $ne: 1 })
      expect(collapseToEqOrNe({ $nin: [null] })).toEqual({ $ne: null })
    })

    it('keeps a list operator over none or several values', () => {
      expect(collapseToEqOrNe({ $in: [] })).toEqual({ $in: [] })
      expect(collapseToEqOrNe({ $in: [1, 2] })).toEqual({ $in: [1, 2] })
      expect(collapseToEqOrNe({ $nin: [] })).toEqual({ $nin: [] })
      expect(collapseToEqOrNe({ $nin: [1, 2] })).toEqual({ $nin: [1, 2] })
    })

    it('keeps a list operator over a single array value', () => {
      expect(collapseToEqOrNe({ $in: [['x']] })).toEqual({ $in: [['x']] })
      expect(collapseToEqOrNe({ $nin: [['x']] })).toEqual({ $nin: [['x']] })
    })

    it('keeps a list operator that is not the only one', () => {
      expect(collapseToEqOrNe({ $in: [1], $ne: 2 })).toEqual({
        $in: [1],
        $ne: 2,
      })
      expect(collapseToEqOrNe({ $nin: [1], $gt: 2 })).toEqual({
        $nin: [1],
        $gt: 2,
      })
    })

    it('keeps every other value', () => {
      expect(collapseToEqOrNe(1)).toBe(1)
      expect(collapseToEqOrNe(null)).toBe(null)
      expect(collapseToEqOrNe(undefined)).toBe(undefined)
      expect(collapseToEqOrNe({ $ne: 1 })).toEqual({ $ne: 1 })
      expect(collapseToEqOrNe({ $in: 1 })).toEqual({ $in: 1 })
    })

    it('returns the same reference when nothing changes', () => {
      const value = { $in: [1, 2] }
      expect(collapseToEqOrNe(value)).toBe(value)
    })
  })
}
