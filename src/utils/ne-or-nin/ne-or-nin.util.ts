import { dedupeValues } from '../../common/index.js'

/**
 * Turns a list of values into a query value that excludes all of them: a single
 * remaining value becomes `{ $ne: value }`, everything else `{ $nin: values }`.
 * Values are deduplicated first, so `['a', 'a']` collapses to the `$ne` form. An
 * empty list yields `{ $nin: [] }`, excluding nothing — check for emptiness first
 * if your adapter dislikes an empty `NOT IN ()`.
 *
 * Deduplication compares primitives with `SameValueZero`, plain objects and
 * arrays by content (symbol keys included - sequelize uses them as operators),
 * a `Date` by its time and a mongo `ObjectId` (anything with `toHexString`) by
 * its hex string, so those collapse even though they are distinct references.
 * Other class instances only collapse when they are the same instance. Key
 * order doesn't matter: two plain objects with the same entries in a different
 * order count as one.
 *
 * @param values the values to exclude
 * @returns a `$ne` for a single value, otherwise a `$nin` over the deduplicated values
 *
 * @example
 * ```ts
 * import { neOrNin } from 'feathers-utils/utils'
 *
 * neOrNin([1, 2, 3]) // => { $nin: [1, 2, 3] }
 * neOrNin([1]) // => { $ne: 1 }
 * neOrNin([1, 1]) // => { $ne: 1 }
 * neOrNin([]) // => { $nin: [] }
 *
 * // distinct references, equal values
 * neOrNin([new Date(5), new Date(5)]) // => { $ne: Date(5) }
 *
 * // excluding the records we already have
 * const params = { query: { id: neOrNin(knownIds) }, paginate: false }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/ne-or-nin.html
 */
export function neOrNin<T>(values: readonly T[]): { $ne: T } | { $nin: T[] } {
  const deduped = dedupeValues(values)
  return deduped.length === 1 ? { $ne: deduped[0] } : { $nin: deduped }
}
