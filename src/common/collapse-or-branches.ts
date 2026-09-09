import { collapseToEqOrNe } from './collapse-to-eq-or-ne.js'
import { dedupeValues } from './dedupe-values.js'
import { isOnlyOperator } from './is-only-operator.js'
import { isPlainObject } from './is-plain-object.js'
import { singleProperty } from './single-property.js'

type QueryRecord = Record<string, any>

/**
 * Collapses `$or` branches that constrain the same single property into one `$in`
 * over the union of their values: `[{ a: 1 }, { a: { $in: [2] } }]` becomes
 * `[{ a: { $in: [1, 2] } }]`. What the query matches is unchanged — a disjunction of
 * equality/`$in` conditions on one property *is* an `$in` over their union.
 *
 * A branch only qualifies when it constrains exactly one non-operator property with
 * either a plain equality value or a pure `{ $in: [...] }`. Array equality values are
 * left alone: `{ a: ['x'] }` (the property *is* that array) and `{ a: { $in: [['x']] } }`
 * (which adapters may also satisfy element-wise) are not the same condition. Branches
 * that do not qualify, and properties constrained by only a single branch, are kept
 * untouched and in their original order.
 *
 * @internal shared by `simplifyQuery` and `mergeQuery`.
 */
export function collapseOrBranches(branches: QueryRecord[]): QueryRecord[] {
  const qualifying = branches.map(qualifyingEntry)

  const groups = new Map<string, { values: any[]; branches: number }>()
  for (const entry of qualifying) {
    if (!entry) {
      continue
    }
    const [property, values] = entry
    const group = groups.get(property)
    if (group) {
      group.values.push(...values)
      group.branches++
    } else {
      groups.set(property, { values: [...values], branches: 1 })
    }
  }

  // a property needs at least two branches before there is anything to union
  if (![...groups.values()].some((group) => group.branches > 1)) {
    return branches
  }

  const collapsed = new Set<string>()
  const result: QueryRecord[] = []

  for (let i = 0; i < branches.length; i++) {
    const entry = qualifying[i]
    const property = entry?.[0]
    if (property === undefined || groups.get(property)!.branches < 2) {
      result.push(branches[i])
      continue
    }
    // the union takes the place of the first branch that mentions the property
    if (collapsed.has(property)) {
      continue
    }
    collapsed.add(property)
    result.push({ [property]: toQueryValue(groups.get(property)!.values) })
  }

  return result
}

/**
 * The property and the values a branch matches it against, or `undefined` when the
 * branch is not a single equality/`$in` condition and therefore cannot take part.
 */
function qualifyingEntry(branch: unknown): [string, any[]] | undefined {
  const entry = singleProperty(branch)
  if (!entry) {
    return
  }

  const [property, value] = entry

  if (isOnlyOperator(value, '$in')) {
    return Array.isArray(value.$in) ? [property, value.$in] : undefined
  }

  // any other operator object is a condition we cannot union; `undefined` is not a
  // constraint at all, and an array equality is not an `$in` — see above
  return isPlainObject(value) || Array.isArray(value) || value === undefined
    ? undefined
    : [property, [value]]
}

function toQueryValue(values: any[]): any {
  // `collapseToEqOrNe` turns the union back into an equality when one value remains
  return collapseToEqOrNe({ $in: dedupeValues(values) })
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('collapseOrBranches', () => {
    it('unions two $in on the same property', () => {
      expect(
        collapseOrBranches([{ a: { $in: ['a'] } }, { a: { $in: ['b'] } }]),
      ).toEqual([{ a: { $in: ['a', 'b'] } }])
    })

    it('unions equality values into a $in', () => {
      expect(collapseOrBranches([{ a: 1 }, { a: 2 }])).toEqual([
        { a: { $in: [1, 2] } },
      ])
    })

    it('mixes equality and $in', () => {
      expect(collapseOrBranches([{ a: 1 }, { a: { $in: [2, 3] } }])).toEqual([
        { a: { $in: [1, 2, 3] } },
      ])
    })

    it('dedupes the unioned values', () => {
      expect(
        collapseOrBranches([{ a: { $in: [1, 2] } }, { a: { $in: [2, 3] } }]),
      ).toEqual([{ a: { $in: [1, 2, 3] } }])
    })

    it('collapses to an equality when one value remains', () => {
      expect(collapseOrBranches([{ a: 1 }, { a: { $in: [1] } }])).toEqual([
        { a: 1 },
      ])
    })

    it('keeps the position of the first branch and the rest of the order', () => {
      expect(
        collapseOrBranches([{ a: 1 }, { b: 2 }, { a: 3 }, { c: 4 }]),
      ).toEqual([{ a: { $in: [1, 3] } }, { b: 2 }, { c: 4 }])
    })

    it('collapses several properties independently', () => {
      expect(
        collapseOrBranches([{ a: 1 }, { b: 2 }, { a: 3 }, { b: 4 }]),
      ).toEqual([{ a: { $in: [1, 3] } }, { b: { $in: [2, 4] } }])
    })

    it('leaves a property constrained by a single branch untouched', () => {
      expect(collapseOrBranches([{ a: { $in: [1] } }, { b: 2 }])).toEqual([
        { a: { $in: [1] } },
        { b: 2 },
      ])
    })

    it('does not touch branches with more than one property', () => {
      expect(collapseOrBranches([{ a: 1, b: 2 }, { a: 3 }])).toEqual([
        { a: 1, b: 2 },
        { a: 3 },
      ])
    })

    it('does not touch other operators on the same property', () => {
      expect(
        collapseOrBranches([{ a: { $gt: 1 } }, { a: { $gt: 2 } }]),
      ).toEqual([{ a: { $gt: 1 } }, { a: { $gt: 2 } }])
      expect(
        collapseOrBranches([{ a: { $in: [1], $ne: 2 } }, { a: 3 }]),
      ).toEqual([{ a: { $in: [1], $ne: 2 } }, { a: 3 }])
    })

    it('does not touch nested logical branches', () => {
      const branches = [{ $and: [{ a: 1 }] }, { $and: [{ a: 2 }] }]
      expect(collapseOrBranches(branches)).toEqual(branches)
    })

    it('does not touch array equality values', () => {
      expect(collapseOrBranches([{ a: ['x'] }, { a: ['y'] }])).toEqual([
        { a: ['x'] },
        { a: ['y'] },
      ])
    })

    it('keeps a single array value inside its $in', () => {
      expect(
        collapseOrBranches([{ a: { $in: [['x']] } }, { a: { $in: [['x']] } }]),
      ).toEqual([{ a: { $in: [['x']] } }])
    })

    it('unions equal dates by value', () => {
      expect(
        collapseOrBranches([{ a: new Date(5) }, { a: new Date(5) }]),
      ).toEqual([{ a: new Date(5) }])
    })

    it('ignores non-object branches', () => {
      expect(collapseOrBranches(['u' as any, 'c' as any])).toEqual(['u', 'c'])
    })

    it('unions any number of branches', () => {
      expect(
        collapseOrBranches([{ a: 1 }, { a: { $in: [2, 3] } }, { a: 4 }]),
      ).toEqual([{ a: { $in: [1, 2, 3, 4] } }])
    })

    it('returns fewer than two branches as they are', () => {
      expect(collapseOrBranches([])).toEqual([])
      expect(collapseOrBranches([{ a: 1 }])).toEqual([{ a: 1 }])
    })

    it('does not mutate the input', () => {
      const branches = [{ a: { $in: [1] } }, { a: 2 }]
      const snapshot = structuredClone(branches)
      collapseOrBranches(branches)
      expect(branches).toEqual(snapshot)
    })
  })
}
