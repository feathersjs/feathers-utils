import { dedupeValues } from '../../common/index.js'

/**
 * Turns a list of values into a query value that matches any of them: a single
 * remaining value becomes an equality match, everything else a `$in`. Values are
 * deduplicated first, so `['a', 'a']` collapses to the equality form. An empty
 * list yields `{ $in: [] }`, matching nothing — check for emptiness first if your
 * adapter dislikes an empty `IN ()`.
 *
 * Deduplication compares primitives with `SameValueZero`, plain objects and
 * arrays by content (symbol keys included - sequelize uses them as operators),
 * a `Date` by its time and a mongo `ObjectId` (anything with `toHexString`) by
 * its hex string, so those collapse even though they are distinct references.
 * Other class instances only collapse when they are the same instance. Key
 * order doesn't matter: two plain objects with the same entries in a different
 * order count as one.
 *
 * @param values the values to match against
 * @returns the single value, or a `$in` over the deduplicated values
 *
 * @example
 * ```ts
 * import { eqOrIn } from 'feathers-utils/utils'
 *
 * eqOrIn([1, 2, 3]) // => { $in: [1, 2, 3] }
 * eqOrIn([1]) // => 1
 * eqOrIn([1, 1]) // => 1
 * eqOrIn([]) // => { $in: [] }
 *
 * // distinct references, equal values
 * eqOrIn([new Date(5), new Date(5)]) // => Date(5)
 *
 * // building a query for related records
 * const params = { query: { userId: eqOrIn(userIds) }, paginate: false }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/eq-or-in.html
 */
export function eqOrIn<T>(values: readonly T[]): T | { $in: T[] } {
  const deduped = dedupeValues(values)
  return deduped.length === 1 ? deduped[0] : { $in: deduped }
}
