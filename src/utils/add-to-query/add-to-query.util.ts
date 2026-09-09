import type { Query } from '@feathersjs/feathers'
import { dequal as deepEqual } from 'dequal'
import { extractQueryFilters } from '../../common/extract-query-filters.js'
import { mergeSelect } from '../../common/merge-select.js'

import type { mergeQuery } from '../merge-query/merge-query.util.js'

const filterKeys = ['$select', '$limit', '$skip', '$sort'] as const

/**
 * Safely merges properties into a Feathers query object. If a property already exists
 * with a different value, it wraps both in a `$and` array to preserve both conditions.
 * If the exact same key-value pair already exists, no changes are made. When the added
 * query is itself a pure `$and` (`{ $and: [...] }`), its branches are flattened into the
 * target's `$and` rather than nested.
 *
 * The added query narrows the target — every condition is kept, so the result matches
 * at most what the target matched. Two conditions on the same property are therefore
 * intersected, never unioned: adding `{ role: 'b' }` to `{ role: 'a' }` matches nothing,
 * it does not become `{ role: { $in: ['a', 'b'] } }`. Use {@link mergeQuery} with its
 * default `combine` mode when you want to broaden a query instead.
 *
 * The query filters `$select`, `$limit`, `$skip` and `$sort` are split off and merged
 * separately, never wrapped in an `$and` where no adapter would evaluate them. Since
 * `addToQuery` narrows, they follow the same rules as {@link mergeQuery} in `intersect`
 * mode: the added query wins for `$limit` and `$skip`, `$sort` is merged key by key
 * (the added query wins per key, the target keeps the leading sort order), and
 * `$select` becomes the intersection of both. A filter only one side provides is kept
 * as it is.
 *
 * @example
 * ```ts
 * import { addToQuery } from 'feathers-utils/utils'
 *
 * const query = { status: 'active' }
 * addToQuery(query, { role: 'admin' })
 * // => { status: 'active', role: 'admin' }
 *
 * // both conditions are kept (an intersection), even a contradicting one
 * addToQuery({ something: 1 }, { something: { $in: [2] } })
 * // => { something: 1, $and: [{ something: { $in: [2] } }] }
 * ```
 *
 * @example
 * ```ts
 * // filters never end up in the $and — the added query wins
 * addToQuery({ $limit: 10 }, { $limit: 20 })
 * // => { $limit: 20 }
 *
 * addToQuery({ $sort: { a: 1 } }, { $sort: { b: -1 } })
 * // => { $sort: { a: 1, b: -1 } }
 *
 * // $select narrows to what both sides allow
 * addToQuery({ $select: ['a', 'b'] }, { $select: ['b'] })
 * // => { $select: ['b'] }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/add-to-query.html
 */
export function addToQuery<Q extends Query>(targetQuery: Q, query: Q): Q {
  targetQuery ??= {} as Q

  if (filterKeys.some((key) => key in query)) {
    return addFiltersToQuery(targetQuery, query)
  }

  if (Object.keys(query).length === 0) {
    return targetQuery
  }

  const entries = Object.entries(query) as [keyof Q, any][]

  if (entries.every(([property]) => !(property in targetQuery))) {
    // if none of the properties exist, merge them directly
    return {
      ...targetQuery,
      ...query,
    }
  }

  function isAlreadyInQuery(targetQuery: Q, entries: [keyof Q, any][]) {
    return entries.every(
      ([property, value]) =>
        property in targetQuery && deepEqual(targetQuery[property], value),
    )
  }

  if (isAlreadyInQuery(targetQuery, entries)) {
    // if all properties already exist with the exact same value, do nothing
    return targetQuery
  }

  // when the added query is itself a pure `$and`, flatten its branches into the
  // target's `$and` instead of nesting another `$and` inside it
  if (entries.length === 1 && Array.isArray(query.$and)) {
    const existing = (targetQuery.$and as any[]) ?? []
    const newBranches = (query.$and as any[]).filter(
      (branch) => !existing.some((q) => deepEqual(q, branch)),
    )
    if (newBranches.length === 0) {
      return targetQuery
    }
    return {
      ...targetQuery,
      $and: [...existing, ...newBranches],
    }
  }

  if (!targetQuery.$and) {
    return {
      ...targetQuery,
      $and: [{ ...query }],
    }
  }

  // check if the exact same value already exists in $and
  if (targetQuery.$and.some((q: any) => isAlreadyInQuery(q, entries))) {
    return targetQuery
  }

  return {
    ...targetQuery,
    $and: [...targetQuery.$and, { ...query }],
  }
}

/**
 * Merges a query that carries at least one filter: body and filters are merged
 * separately, then put back together. Only reached from {@link addToQuery}.
 */
function addFiltersToQuery<Q extends Query>(targetQuery: Q, query: Q): Q {
  const target = extractQueryFilters(targetQuery)
  const source = extractQueryFilters(query)

  const result: Query = { ...addToQuery(target.query as Q, source.query as Q) }

  const $select = mergeSelect(target.$select, source.$select, 'intersect')
  if ($select !== undefined) {
    result.$select = $select
  }

  if ('$limit' in source) {
    result.$limit = source.$limit
  } else if ('$limit' in target) {
    result.$limit = target.$limit
  }

  if ('$skip' in source) {
    result.$skip = source.$skip
  } else if ('$skip' in target) {
    result.$skip = target.$skip
  }

  if ('$sort' in target || '$sort' in source) {
    result.$sort = { ...target.$sort, ...source.$sort }
  }

  return result as Q
}
