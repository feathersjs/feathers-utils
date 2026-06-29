import type { Query } from '@feathersjs/feathers'
import { isEmptyObject } from '../../common/is-empty-object.js'
import { dedupeBranches } from '../../common/dedupe-branches.js'
import { flattenAndBranches } from '../../common/flatten-and-branches.js'
import { flattenOrBranches } from '../../common/flatten-or-branches.js'
import { mergeAndBranchesUp } from './merge-and-branches-up.js'
import { mergeOrBranchUp } from './merge-or-branch-up.js'

export interface SimplifyQueryOptions {
  /**
   * Dissolve a top-level single-branch `$and` by merging its branch up into the
   * query (only when no key would collide). Nested levels are always dissolved.
   * Default `true`.
   */
  replaceAnd?: boolean
  /**
   * Dissolve a top-level single-branch `$or` by merging its branch up into the
   * query (only when no key would collide). Nested levels are always dissolved.
   * Default `true`.
   */
  replaceOr?: boolean
}

/**
 * Normalizes the logical structure of a Feathers query without changing what it
 * matches: empty `$and`/`$or` are dropped, duplicate branches removed, nested
 * same-operator branches hoisted (`$and`-in-`$and`, pure `$or`-in-`$or`), and
 * branches merged up into the parent where it is safe — all of an `$and` when no
 * key collides, a single-branch `$or`. Runs recursively. Inputs are not mutated;
 * a query with nothing to simplify is returned unchanged.
 *
 * @param query the query to simplify (a falsy query is returned as-is)
 * @param options
 * @returns the simplified query
 *
 * @example
 * ```ts
 * import { simplifyQuery } from 'feathers-utils/utils'
 *
 * // non-colliding $and branches (here also a hoisted nested $and) merge up
 * simplifyQuery({ $and: [{ id: 1 }, { $and: [{ status: 'a' }] }] })
 * // => { id: 1, status: 'a' }
 *
 * simplifyQuery({ $or: [{ id: 1 }] })
 * // => { id: 1 }
 *
 * // a colliding key keeps the $and intact
 * simplifyQuery({ $and: [{ price: { $gt: 1 } }, { price: { $lt: 9 } }] })
 * // => { $and: [{ price: { $gt: 1 } }, { price: { $lt: 9 } }] }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/simplify-query.html
 */
export function simplifyQuery<Q extends Query | null | undefined>(
  query: Q,
  options: SimplifyQueryOptions = {},
): Q {
  const { replaceAnd = true, replaceOr = true } = options
  return simplify(query, replaceAnd, replaceOr)
}

function simplify(query: any, replaceAnd: boolean, replaceOr: boolean): any {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return query
  }

  const hasAnd = Array.isArray(query.$and)
  const hasOr = Array.isArray(query.$or)
  if (!hasAnd && !hasOr) {
    return query
  }

  const { $and, $or, ...rest } = query
  const result: Record<string, any> = { ...rest }

  if (hasAnd) {
    // an empty `{}` branch is the AND identity → dropped by dedupeBranches
    const branches = dedupeBranches(
      flattenAndBranches($and.map((b: any) => simplify(b, true, true))),
    )
    if (branches.length > 0) {
      result.$and = branches
    }
  }

  if (hasOr) {
    const simplified = $or.map((b: any) => simplify(b, true, true))
    // an empty `{}` branch makes the whole `$or` match-all → drop the `$or`
    if (!simplified.some(isEmptyObject)) {
      const branches = dedupeBranches(flattenOrBranches(simplified))
      if (branches.length > 0) {
        result.$or = branches
      }
    }
  }

  return mergeOrBranchUp(mergeAndBranchesUp(result, replaceAnd), replaceOr)
}
