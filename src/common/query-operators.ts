/**
 * Query operators whose value is an array of sub-queries (branches). Their
 * branches have to be traversed individually — they are never part of a
 * property path.
 */
export const branchOperators = new Set(['$or', '$and', '$nor'])

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('query-operators', () => {
    it('contains the branch operators', () => {
      expect([...branchOperators].sort()).toEqual(['$and', '$nor', '$or'])
    })
  })
}
