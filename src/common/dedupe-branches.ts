import { dequal as deepEqual } from 'dequal'
import { isEmptyObject } from './is-empty-object.js'

type QueryRecord = Record<string, any>

/**
 * Removes empty (`{}`) and deep-equal duplicate branches from a logical
 * (`$and`/`$or`) branch array, preserving order. Internal query-AST helper.
 */
export function dedupeBranches(branches: QueryRecord[]): QueryRecord[] {
  const result: QueryRecord[] = []
  for (const branch of branches) {
    if (isEmptyObject(branch)) {
      continue
    }
    if (!result.some((existing) => deepEqual(existing, branch))) {
      result.push(branch)
    }
  }
  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('dedupeBranches', () => {
    it('removes empty objects and deep-equal duplicates', () => {
      expect(dedupeBranches([{ id: 1 }, {}, { id: 1 }, { id: 2 }])).toEqual([
        { id: 1 },
        { id: 2 },
      ])
    })

    it('preserves order', () => {
      expect(dedupeBranches([{ b: 2 }, { a: 1 }])).toEqual([{ b: 2 }, { a: 1 }])
    })

    it('returns an empty array when all branches are empty', () => {
      expect(dedupeBranches([{}, {}])).toEqual([])
    })
  })
}
