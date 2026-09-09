import { branchOperators } from '../../common/query-operators.js'
import { collapseToEqOrNe } from '../../common/collapse-to-eq-or-ne.js'
import { isPlainObject } from '../../common/is-plain-object.js'

type QueryRecord = Record<string, any>

/**
 * Applies {@link collapseToEqOrNe} to every property value of a query, descending into
 * the branches of `$or`, `$and` and `$nor`. Other nested objects are left alone: a
 * property value like `{ meta: { tag: { $in: ['a'] } } }` may well be an equality match
 * against that exact object rather than a nested condition, and rewriting it would
 * change what the query matches. Returns the same reference when nothing changed.
 * Internal helper for {@link simplifyQuery}.
 */
export function collapseToEqOrNeDeep(query: any): any {
  if (!isPlainObject(query)) {
    return query
  }

  let changed = false
  const result: QueryRecord = {}

  for (const [key, value] of Object.entries(query)) {
    let next = value

    if (branchOperators.has(key) && Array.isArray(value)) {
      const branches = value.map(collapseToEqOrNeDeep)
      if (branches.some((branch, i) => branch !== value[i])) {
        next = branches
      }
    } else {
      next = collapseToEqOrNe(value)
    }

    if (next !== value) {
      changed = true
    }
    result[key] = next
  }

  return changed ? result : query
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('collapseToEqOrNeDeep', () => {
    it('collapses a single-value $in and $nin on a property', () => {
      expect(
        collapseToEqOrNeDeep({ a: { $in: [1] }, b: { $nin: [2] }, c: 3 }),
      ).toEqual({ a: 1, b: { $ne: 2 }, c: 3 })
    })

    it('descends into $or, $and and $nor branches', () => {
      expect(
        collapseToEqOrNeDeep({
          $or: [{ a: { $in: [1] } }, { $and: [{ b: { $nin: [2] } }] }],
          $nor: [{ c: { $in: [3] } }],
        }),
      ).toEqual({
        $or: [{ a: 1 }, { $and: [{ b: { $ne: 2 } }] }],
        $nor: [{ c: 3 }],
      })
    })

    it('keeps everything a single-value list operator is not', () => {
      const query = {
        a: { $in: [1, 2] },
        b: { $in: [] },
        c: { $in: [1], $ne: 2 },
        d: { $nin: [1, 2] },
        e: 1,
        f: { $in: [['x']] },
      }
      expect(collapseToEqOrNeDeep(query)).toBe(query)
    })

    it('does not descend into other nested objects', () => {
      const query = { meta: { tag: { $in: ['a'] } } }
      expect(collapseToEqOrNeDeep(query)).toBe(query)
    })

    it('returns the same reference when nothing changed', () => {
      const query = { a: 1, $or: [{ b: 2 }] }
      expect(collapseToEqOrNeDeep(query)).toBe(query)
    })

    it('does not mutate the input', () => {
      const query = { a: { $in: [1] }, $or: [{ b: { $in: [2] } }] }
      const snapshot = structuredClone(query)
      collapseToEqOrNeDeep(query)
      expect(query).toEqual(snapshot)
    })

    it('passes non-object queries through', () => {
      expect(collapseToEqOrNeDeep(null)).toBe(null)
      expect(collapseToEqOrNeDeep('a')).toBe('a')
    })
  })
}
