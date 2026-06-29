import type { Query } from '@feathersjs/feathers'
import { simplifyQuery } from '../simplify-query/simplify-query.util.js'
import { extractQueryFilters } from './extract-query-filters.js'
import { mergeQueryBodies } from './merge-query-bodies.js'
import { mergeSelect } from './merge-select.js'

export type MergeQueryMode = 'target' | 'source' | 'combine' | 'intersect'

export interface MergeQueryOptions {
  /**
   * How to merge query properties that both queries constrain.
   *
   * - `combine` (default): broaden — the two queries always become branches of an `$or`.
   * - `intersect`: narrow — non-conflicting properties merge flat, conflicts become an `$and`.
   * - `target`: keep the target's value on conflict.
   * - `source`: keep the source's value on conflict.
   */
  mode?: MergeQueryMode
}

/**
 * Properties are combined with a logical operator rather than merged at the value
 * level, so the result is always a valid query: `combine` always wraps the two
 * queries in `$or` (broaden — OR has no flat form), while `intersect` merges
 * non-conflicting properties flat and wraps conflicts in `$and` (narrow). The
 * special filters `$select`, `$limit`, `$skip` and `$sort` are merged separately.
 * Inputs are never mutated.
 *
 * This is well suited to merging a client-provided query with a server-side
 * restriction inside a hook.
 *
 * @param target Query to be merged into
 * @param source Query to be merged from
 * @param options
 * @returns the merged query
 *
 * @example
 * ```ts
 * import { mergeQuery } from 'feathers-utils/utils'
 *
 * // combine (default): the two queries always become an $or
 * mergeQuery({ id: 1 }, { id: 2 })
 * // => { $or: [{ id: 1 }, { id: 2 }] }
 *
 * mergeQuery({ status: 'active' }, { authorId: 5 })
 * // => { $or: [{ status: 'active' }, { authorId: 5 }] }
 * ```
 *
 * @example
 * ```ts
 * // intersect: non-conflicting properties merge flat, conflicts become an $and
 * mergeQuery({ status: 'active' }, { authorId: 5 }, { mode: 'intersect' })
 * // => { status: 'active', authorId: 5 }
 *
 * mergeQuery({ id: 1 }, { id: 2 }, { mode: 'intersect' })
 * // => { $and: [{ id: 1 }, { id: 2 }] }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/merge-query.html
 */
export function mergeQuery(
  target: Query,
  source: Query,
  options?: MergeQueryOptions,
): Query {
  const mode = options?.mode ?? 'combine'

  // normalize inputs first: drop empty/duplicate/redundant logical wrappers and
  // hoist nested operators, so the merge works on clean, canonical queries
  const targetFilters = extractQueryFilters(simplifyQuery(target))
  const sourceFilters = extractQueryFilters(simplifyQuery(source))

  const result: Query = mergeQueryBodies(
    targetFilters.query,
    sourceFilters.query,
    mode,
  )

  const $select = mergeSelect(
    targetFilters.$select,
    sourceFilters.$select,
    mode,
  )
  if ($select !== undefined) {
    result.$select = $select
  }

  if ('$limit' in sourceFilters) {
    result.$limit = sourceFilters.$limit
  } else if ('$limit' in targetFilters) {
    result.$limit = targetFilters.$limit
  }

  if ('$skip' in sourceFilters) {
    result.$skip = sourceFilters.$skip
  } else if ('$skip' in targetFilters) {
    result.$skip = targetFilters.$skip
  }

  if ('$sort' in targetFilters || '$sort' in sourceFilters) {
    result.$sort = { ...targetFilters.$sort, ...sourceFilters.$sort }
  }

  return result
}
