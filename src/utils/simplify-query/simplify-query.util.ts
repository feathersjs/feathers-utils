import type { Query } from '@feathersjs/feathers'
import { isEmptyObject } from '../../common/is-empty-object.js'
import { collapseOrBranches } from '../../common/collapse-or-branches.js'
import { dedupeBranches } from '../../common/dedupe-branches.js'
import { flattenAndBranches } from '../../common/flatten-and-branches.js'
import { flattenOrBranches } from '../../common/flatten-or-branches.js'
import { collapseToEqOrNeDeep } from './collapse-to-eq-or-ne-deep.js'
import { mergeAndBranchesUp } from './merge-and-branches-up.js'
import { mergeOrBranchUp } from './merge-or-branch-up.js'

export interface SimplifyQueryOptions {
  /**
   * Dissolve a top-level single-branch `$and` by merging its branch up into the
   * query (only when no key would collide). Nested levels are always dissolved.
   *
   * @default true
   */
  replaceAnd?: boolean
  /**
   * Dissolve a top-level single-branch `$or` by merging its branch up into the
   * query (only when no key would collide). Nested levels are always dissolved.
   *
   * @default true
   */
  replaceOr?: boolean
  /**
   * Collapse `$or` branches that constrain the same single property with an
   * equality or `$in` into one `$in` over the union of their values. Turn this
   * off when `$in` is not an option for that property — it is the one
   * simplification that can introduce an operator the query did not use.
   *
   * @default true
   */
  collapseOrToIn?: boolean
  /**
   * Rewrite a single-value `$in`/`$nin` query value to the plain condition it already
   * is: `{ $in: [x] }` to `x`, `{ $nin: [x] }` to `{ $ne: x }`. Applies to every
   * property, not just the ones an `$or` touches. A single *array* value keeps its
   * list operator, since that is a different condition.
   *
   * @default true
   */
  collapseToEqOrNe?: boolean
}

type StructureOptions = Omit<Required<SimplifyQueryOptions>, 'collapseToEqOrNe'>

/**
 * Normalizes the logical structure of a Feathers query without changing what it
 * matches: empty `$and`/`$or` are dropped, duplicate branches removed, nested
 * same-operator branches hoisted (`$and`-in-`$and`, pure `$or`-in-`$or`), `$or`
 * branches on the same property collapsed into a single `$in`, single-value `$in`/`$nin`
 * written as an equality/`$ne`, and branches merged up into the parent where it is
 * safe — all of an `$and` when no key collides, a single-branch `$or`. Runs
 * recursively. Inputs are not mutated; a query with nothing to simplify is returned
 * unchanged.
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
 * @example
 * ```ts
 * // an $or over the same property is an $in over the union of its values
 * simplifyQuery({ $or: [{ role: { $in: ['a'] } }, { role: { $in: ['b'] } }] })
 * // => { role: { $in: ['a', 'b'] } }
 *
 * simplifyQuery({ $or: [{ role: 'a' }, { role: 'b' }, { status: 'active' }] })
 * // => { $or: [{ role: { $in: ['a', 'b'] } }, { status: 'active' }] }
 *
 * simplifyQuery({ $or: [{ role: 'a' }, { role: 'b' }] }, { collapseOrToIn: false })
 * // => { $or: [{ role: 'a' }, { role: 'b' }] }
 * ```
 *
 * @example
 * ```ts
 * // a $in / $nin over a single value is an equality / $ne
 * simplifyQuery({ role: { $in: ['admin'] } })
 * // => { role: 'admin' }
 *
 * simplifyQuery({ role: { $nin: ['admin'] } })
 * // => { role: { $ne: 'admin' } }
 *
 * // ... but not over a single array value, which is a different condition
 * simplifyQuery({ roles: { $in: [['admin']] } })
 * // => { roles: { $in: [['admin']] } }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/simplify-query.html
 */
export function simplifyQuery<Q extends Query | null | undefined>(
  query: Q,
  options: SimplifyQueryOptions = {},
): Q {
  const {
    replaceAnd = true,
    replaceOr = true,
    collapseOrToIn = true,
    collapseToEqOrNe = true,
  } = options

  // a value-level pass first, so the structural one works on canonical values
  const normalized = collapseToEqOrNe ? collapseToEqOrNeDeep(query) : query

  return simplify(normalized, { replaceAnd, replaceOr, collapseOrToIn })
}

function simplify(query: any, options: StructureOptions): any {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return query
  }

  const hasAnd = Array.isArray(query.$and)
  const hasOr = Array.isArray(query.$or)
  if (!hasAnd && !hasOr) {
    return query
  }

  // nested levels always dissolve single branches — only the top level is optional
  const nested: StructureOptions = {
    ...options,
    replaceAnd: true,
    replaceOr: true,
  }

  const { $and, $or, ...rest } = query
  const result: Record<string, any> = { ...rest }

  if (hasAnd) {
    // an empty `{}` branch is the AND identity → dropped by dedupeBranches
    const branches = dedupeBranches(
      flattenAndBranches($and.map((b: any) => simplify(b, nested))),
    )
    if (branches.length > 0) {
      result.$and = branches
    }
  }

  if (hasOr) {
    const simplified = $or.map((b: any) => simplify(b, nested))
    // an empty `{}` branch makes the whole `$or` match-all → drop the `$or`
    if (!simplified.some(isEmptyObject)) {
      const deduped = dedupeBranches(flattenOrBranches(simplified))
      const branches = options.collapseOrToIn
        ? collapseOrBranches(deduped)
        : deduped
      if (branches.length > 0) {
        result.$or = branches
      }
    }
  }

  return mergeOrBranchUp(
    mergeAndBranchesUp(result, options.replaceAnd),
    options.replaceOr,
  )
}
