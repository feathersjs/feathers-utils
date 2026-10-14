import safeStringify from 'safe-stable-stringify'
import { isEqual } from './is-equal.js'
import { isEmptyObject } from './is-empty-object.js'

type QueryRecord = Record<string, any>

/** From this many branches on, bucketing them beats comparing every pair. */
const BUCKET_FROM = 16

/**
 * Removes empty (`{}`) and equal ({@link isEqual}) duplicate branches from a
 * logical (`$and`/`$or`) branch array, preserving order. Internal query-AST
 * helper.
 *
 * A long branch array is bucketed by a stable serialization first - equal
 * branches serialize the same - so only the branches of one bucket are
 * compared, instead of every pair.
 */
export function dedupeBranches(branches: QueryRecord[]): QueryRecord[] {
  const result: QueryRecord[] = []
  const buckets =
    branches.length >= BUCKET_FROM
      ? new Map<string, QueryRecord[]>()
      : undefined

  for (const branch of branches) {
    if (isEmptyObject(branch)) {
      continue
    }
    if (buckets) {
      const key = safeStringify(branch) as string
      const bucket = buckets.get(key)
      if (!bucket) {
        buckets.set(key, [branch])
      } else if (bucket.some((seen) => isEqual(seen, branch))) {
        continue
      } else {
        bucket.push(branch)
      }
    } else if (result.some((existing) => isEqual(existing, branch))) {
      continue
    }
    result.push(branch)
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

    it('keeps branches that differ only in symbol operators', () => {
      const lt = Symbol('lt')
      const gt = Symbol('gt')
      const branches = [{ age: { [lt]: 18 } }, { age: { [gt]: 65 } }]
      expect(dedupeBranches(branches)).toStrictEqual(branches)
    })

    describe('a long branch array', () => {
      const ids = (count: number) =>
        Array.from({ length: count }, (_, i) => ({ id: i }))

      it('removes duplicates, in any key order, preserving order', () => {
        const branches = [
          ...ids(20),
          { id: 3 },
          { a: 1, b: 2 },
          { b: 2, a: 1 },
          {},
        ]
        expect(dedupeBranches(branches)).toEqual([...ids(20), { a: 1, b: 2 }])
      })

      it('keeps branches that serialize the same but differ', () => {
        // symbol keys don't serialize, so these share a bucket
        const lt = Symbol('lt')
        const gt = Symbol('gt')
        const branches = [
          ...ids(20),
          { age: { [lt]: 18 } },
          { age: { [gt]: 65 } },
        ]
        expect(dedupeBranches(branches)).toStrictEqual(branches)
      })
    })
  })
}
