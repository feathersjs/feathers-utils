import type { Query } from '@feathersjs/feathers'
import { normalize } from './normalize.js'

/**
 * Recursively normalizes a Feathers query object for order-independent comparison.
 * Sorts object keys and sorts arrays within `$or`, `$and`, `$nor`, `$not`, `$in`,
 * and `$nin` operators so that different orderings produce the same result.
 *
 * This is useful for generating stable cache keys where
 * `{ $or: [{ a: 1 }, { b: 2 }] }` and `{ $or: [{ b: 2 }, { a: 1 }] }`
 * should be treated as equivalent.
 *
 * @example
 * ```ts
 * import { sortQueryProperties } from 'feathers-utils/utils'
 *
 * const normalized = sortQueryProperties({
 *   $or: [{ name: 'Jane' }, { name: 'John' }],
 *   age: { $in: [30, 25] },
 * })
 * // => { $or: [{ name: 'John' }, { name: 'Jane' }], age: { $in: [25, 30] } }
 * // (sorted by stable stringify comparison)
 * ```
 *
 * @see https://utils.feathersjs.com/utils/sort-query-properties.html
 */
export const sortQueryProperties = <Q extends Query>(query: Q): Q => {
  return normalize(query) as Q
}
