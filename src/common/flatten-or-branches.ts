type QueryRecord = Record<string, any>

/**
 * Recursively hoists nested *pure* `$or` branches so that an `$or` never contains
 * another `{ $or: [...] }`-only branch. `$or` is associative, so a branch that is
 * exactly `{ $or: [a, b] }` is replaced by `a` and `b`. A branch that mixes `$or`
 * with other keys is left intact (its other keys are AND-ed and cannot be hoisted).
 * Internal query-AST helper.
 */
export function flattenOrBranches(branches: QueryRecord[]): QueryRecord[] {
  const result: QueryRecord[] = []
  for (const branch of branches) {
    const keys = Object.keys(branch)
    if (keys.length === 1 && keys[0] === '$or' && Array.isArray(branch.$or)) {
      result.push(...flattenOrBranches(branch.$or))
    } else {
      result.push(branch)
    }
  }
  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('flattenOrBranches', () => {
    it('leaves plain branches untouched', () => {
      expect(flattenOrBranches([{ a: 1 }, { b: 2 }])).toEqual([
        { a: 1 },
        { b: 2 },
      ])
    })

    it('hoists a pure $or branch', () => {
      expect(
        flattenOrBranches([{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }]),
      ).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
    })

    it('does not hoist a $or branch mixed with other keys', () => {
      expect(flattenOrBranches([{ $or: [{ b: 2 }], x: 1 }])).toEqual([
        { $or: [{ b: 2 }], x: 1 },
      ])
    })

    it('flattens recursively', () => {
      expect(
        flattenOrBranches([{ $or: [{ $or: [{ a: 1 }] }, { b: 2 }] }]),
      ).toEqual([{ a: 1 }, { b: 2 }])
    })
  })
}
