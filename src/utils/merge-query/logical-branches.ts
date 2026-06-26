type QueryRecord = Record<string, any>

/**
 * Returns the branches of a logical-only query (a query whose single key is `op`),
 * or `null` when the query is not purely `{ [op]: [...] }`. Internal helper for
 * {@link mergeQuery}.
 */
export function logicalBranches(
  query: QueryRecord,
  op: '$or' | '$and',
): QueryRecord[] | null {
  const keys = Object.keys(query)
  if (keys.length === 1 && keys[0] === op && Array.isArray(query[op])) {
    return query[op] as QueryRecord[]
  }
  return null
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('logicalBranches', () => {
    it('returns branches for a logical-only query', () => {
      expect(logicalBranches({ $or: [{ id: 1 }] }, '$or')).toEqual([{ id: 1 }])
    })

    it('returns null when the operator is mixed with other keys', () => {
      expect(logicalBranches({ $or: [{ id: 1 }], a: 1 }, '$or')).toBeNull()
    })

    it('returns null for the wrong operator', () => {
      expect(logicalBranches({ $and: [{ id: 1 }] }, '$or')).toBeNull()
    })

    it('returns null when the operator value is not an array', () => {
      expect(logicalBranches({ $or: { id: 1 } }, '$or')).toBeNull()
    })
  })
}
