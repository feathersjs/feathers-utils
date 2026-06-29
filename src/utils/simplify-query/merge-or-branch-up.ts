import { dequal as deepEqual } from 'dequal'

type QueryRecord = Record<string, any>

/**
 * `$or` is a disjunction, so only a *single* branch can be merged up (an `$or` of
 * one is just that branch) — and only when no key would collide. This is the key
 * asymmetry with `$and` ({@link mergeAndBranchesUp}). Internal helper for
 * {@link simplifyQuery}.
 */
export function mergeOrBranchUp(
  result: QueryRecord,
  enabled: boolean,
): QueryRecord {
  if (!enabled || !Array.isArray(result.$or) || result.$or.length !== 1) {
    return result
  }
  const branch = result.$or[0]
  const rest = { ...result }
  delete rest.$or
  for (const key of Object.keys(branch)) {
    if (key in rest && !deepEqual(rest[key], branch[key])) {
      return result
    }
  }
  return { ...rest, ...branch }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('mergeOrBranchUp', () => {
    it('merges a single branch up when keys do not collide', () => {
      expect(mergeOrBranchUp({ a: 1, $or: [{ b: 2 }] }, true)).toEqual({
        a: 1,
        b: 2,
      })
    })

    it('collapses a sole single-branch $or to that branch', () => {
      expect(mergeOrBranchUp({ $or: [{ a: 1 }] }, true)).toEqual({ a: 1 })
    })

    it('keeps the $or on a collision with a root key', () => {
      expect(mergeOrBranchUp({ a: 1, $or: [{ a: 2 }] }, true)).toEqual({
        a: 1,
        $or: [{ a: 2 }],
      })
    })

    it('does NOT merge a multi-branch $or', () => {
      expect(mergeOrBranchUp({ $or: [{ a: 1 }, { b: 2 }] }, true)).toEqual({
        $or: [{ a: 1 }, { b: 2 }],
      })
    })

    it('does nothing when disabled', () => {
      expect(mergeOrBranchUp({ $or: [{ a: 1 }] }, false)).toEqual({
        $or: [{ a: 1 }],
      })
    })

    it('ignores a missing $or', () => {
      expect(mergeOrBranchUp({ a: 1 }, true)).toEqual({ a: 1 })
    })

    it('does not mutate the input', () => {
      const query = { a: 1, $or: [{ b: 2 }] }
      const snapshot = structuredClone(query)
      mergeOrBranchUp(query, true)
      expect(query).toEqual(snapshot)
    })
  })
}
