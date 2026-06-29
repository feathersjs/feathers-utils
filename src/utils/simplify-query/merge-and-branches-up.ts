import { dequal as deepEqual } from 'dequal'

type QueryRecord = Record<string, any>

/**
 * `$and` is an implicit AND with the rest of the query, so ALL of its branches can
 * be merged up into the parent at once — as long as no key would be set to two
 * different values (across the branches or the existing keys). On any such collision
 * the `$and` is kept intact. Internal helper for {@link simplifyQuery}.
 */
export function mergeAndBranchesUp(
  result: QueryRecord,
  enabled: boolean,
): QueryRecord {
  if (!enabled || !Array.isArray(result.$and) || result.$and.length === 0) {
    return result
  }
  const rest = { ...result }
  delete rest.$and
  const seen = new Map<string, any>(Object.entries(rest))
  for (const branch of result.$and) {
    for (const [key, value] of Object.entries(branch)) {
      if (seen.has(key) && !deepEqual(seen.get(key), value)) {
        return result
      }
      seen.set(key, value)
    }
  }
  return Object.assign(rest, ...result.$and)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('mergeAndBranchesUp', () => {
    it('merges all branches up when keys do not collide', () => {
      expect(mergeAndBranchesUp({ $and: [{ a: 1 }, { b: 2 }] }, true)).toEqual({
        a: 1,
        b: 2,
      })
    })

    it('merges branches up alongside existing root keys', () => {
      expect(
        mergeAndBranchesUp({ c: 3, $and: [{ a: 1 }, { b: 2 }] }, true),
      ).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('keeps the $and on a value collision between branches', () => {
      expect(mergeAndBranchesUp({ $and: [{ a: 1 }, { a: 2 }] }, true)).toEqual({
        $and: [{ a: 1 }, { a: 2 }],
      })
    })

    it('keeps the $and on a collision with a root key', () => {
      expect(mergeAndBranchesUp({ a: 1, $and: [{ a: 2 }] }, true)).toEqual({
        a: 1,
        $and: [{ a: 2 }],
      })
    })

    it('allows a branch key equal to an existing root value', () => {
      expect(
        mergeAndBranchesUp({ a: 1, $and: [{ a: 1 }, { b: 2 }] }, true),
      ).toEqual({ a: 1, b: 2 })
    })

    it('does nothing when disabled', () => {
      expect(mergeAndBranchesUp({ $and: [{ a: 1 }] }, false)).toEqual({
        $and: [{ a: 1 }],
      })
    })

    it('ignores a missing or empty $and', () => {
      expect(mergeAndBranchesUp({ a: 1 }, true)).toEqual({ a: 1 })
      expect(mergeAndBranchesUp({ $and: [] }, true)).toEqual({ $and: [] })
    })

    it('does not mutate the input', () => {
      const query = { c: 3, $and: [{ a: 1 }, { b: 2 }] }
      const snapshot = structuredClone(query)
      mergeAndBranchesUp(query, true)
      expect(query).toEqual(snapshot)
    })
  })
}
