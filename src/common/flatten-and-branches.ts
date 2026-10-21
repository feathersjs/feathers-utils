import { isEmptyObject } from '../helpers/is-empty-object/is-empty-object.helper.js'

type QueryRecord = Record<string, any>

/**
 * Recursively hoists nested `$and` conjuncts so that an `$and` never contains
 * another `$and` branch. `$and` is associative, so a branch like
 * `{ $or: [...], $and: [n] }` is split into the two conjuncts `{ $or: [...] }`
 * and `n`. A pure `{ $and: [...] }` branch contributes only its inner branches.
 * Internal query-AST helper.
 */
export function flattenAndBranches(branches: QueryRecord[]): QueryRecord[] {
  const result: QueryRecord[] = []
  for (const branch of branches) {
    if (Array.isArray(branch.$and)) {
      const { $and, ...rest } = branch
      // the rest may hold only symbol keys (sequelize's operators)
      if (!isEmptyObject(rest)) {
        result.push(rest)
      }
      for (const nested of flattenAndBranches($and)) result.push(nested)
    } else {
      result.push(branch)
    }
  }
  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('flattenAndBranches', () => {
    it('keeps the rest of a branch when it holds only symbol keys', () => {
      const or = Symbol.for('or')
      const result = flattenAndBranches([
        { $and: [{ a: 1 }], [or]: [{ b: 1 }] },
      ])

      expect(result).toHaveLength(2)
      expect(result[0][or as any]).toEqual([{ b: 1 }])
      expect(result[1]).toEqual({ a: 1 })
    })

    it('leaves plain branches untouched', () => {
      expect(flattenAndBranches([{ id: 1 }, { id: 2 }])).toEqual([
        { id: 1 },
        { id: 2 },
      ])
    })

    it('hoists a nested $and and keeps the remaining keys as a branch', () => {
      expect(
        flattenAndBranches([{ $or: ['c'], $and: [{ $nor: ['n'] }] }]),
      ).toEqual([{ $or: ['c'] }, { $nor: ['n'] }])
    })

    it('drops the remainder when a branch is a pure $and', () => {
      expect(flattenAndBranches([{ $and: [{ id: 1 }, { id: 2 }] }])).toEqual([
        { id: 1 },
        { id: 2 },
      ])
    })

    it('flattens recursively', () => {
      expect(
        flattenAndBranches([{ $and: [{ $and: [{ id: 1 }] }, { id: 2 }] }]),
      ).toEqual([{ id: 1 }, { id: 2 }])
    })
  })
}
