import type { Query } from '@feathersjs/feathers'

export type FilterQueryResult<Q extends Query = Query> = {
  $select?: Q['$select']
  $limit?: Q['$limit']
  $skip?: Q['$skip']
  $sort?: Q['$sort']
  query: Omit<Q, '$select' | '$limit' | '$skip' | '$sort'>
}

/**
 * Splits a query into its special filters ($select, $limit, $skip, $sort) and the
 * remaining query body. Internal helper for {@link mergeQuery} — not part of the
 * public API.
 */
export function extractQueryFilters<Q extends Query>(
  providedQuery?: Q,
): FilterQueryResult<Q> {
  providedQuery ??= {} as Q
  const { $select, $limit, $skip, $sort, ...query } = providedQuery

  const result: FilterQueryResult<Q> = { query } as FilterQueryResult<Q>

  if ('$select' in providedQuery) {
    result.$select = $select
  }

  if ('$limit' in providedQuery) {
    result.$limit = $limit
  }

  if ('$skip' in providedQuery) {
    result.$skip = $skip
  }

  if ('$sort' in providedQuery) {
    result.$sort = $sort
  }

  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('extractQueryFilters', () => {
    it('splits filters from the query body', () => {
      expect(
        extractQueryFilters({
          $select: ['a'],
          $limit: 10,
          $skip: 10,
          $sort: { a: 1 },
          a: 1,
          b: 2,
        }),
      ).toEqual({
        $select: ['a'],
        $limit: 10,
        $skip: 10,
        $sort: { a: 1 },
        query: { a: 1, b: 2 },
      })
    })

    it('omits filters that are not provided', () => {
      expect(extractQueryFilters({ a: 1, b: 2 })).toEqual({
        query: { a: 1, b: 2 },
      })
    })

    it('returns an empty body for an empty query', () => {
      expect(extractQueryFilters({})).toEqual({ query: {} })
    })

    it('returns an empty body for undefined', () => {
      expect(extractQueryFilters(undefined)).toEqual({ query: {} })
    })
  })
}
