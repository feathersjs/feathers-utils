import type { MaybeArray } from '../internal.utils.js'

/**
 * Whether `actual` is `expected`, or one of them: for an option that takes one value or a
 * list, e.g. `method: 'patch'` or `method: ['create', 'patch']`. Runs in most hooks on every
 * call, so it makes no array of a single value, and loops: over a list this short, faster
 * than `indexOf` or `includes`, whose call costs more than the search.
 *
 * @example
 * ```ts
 * if (!maybeArrayMatches(options.method, context.method)) return
 * ```
 */
export function maybeArrayMatches<T>(
  expected: MaybeArray<T>,
  actual: unknown,
): boolean {
  if (!Array.isArray(expected)) return expected === actual
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] === actual) return true
  }
  return false
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('maybeArrayMatches', () => {
    it('matches a single value', () => {
      expect(maybeArrayMatches('patch', 'patch')).toBe(true)
      expect(maybeArrayMatches('patch', 'create')).toBe(false)
    })

    it('matches one of a list', () => {
      expect(maybeArrayMatches(['create', 'patch'], 'patch')).toBe(true)
      expect(maybeArrayMatches(['create', 'patch'], 'remove')).toBe(false)
      expect(maybeArrayMatches([], 'patch')).toBe(false)
    })

    it('matches null, as an id of the multi variants', () => {
      expect(maybeArrayMatches([1, null], null)).toBe(true)
      expect(maybeArrayMatches(null, null)).toBe(true)
      expect(maybeArrayMatches(null, undefined)).toBe(false)
    })
  })
}
