import type { Query } from '@feathersjs/feathers'
import isObject from 'lodash/isObject.js'

const arrayOperators = new Set(['$or', '$and', '$nor', '$not', '$in', '$nin'])

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

const normalize = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(normalize)
  }

  if (!isObject(value)) {
    return value
  }

  const sorted: Record<string, any> = {}

  for (const key of Object.keys(value as Record<string, any>).sort()) {
    const val = (value as Record<string, any>)[key]

    if (arrayOperators.has(key) && Array.isArray(val)) {
      sorted[key] = val
        .map(normalize)
        .sort((a: any, b: any) =>
          JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
        )
    } else {
      sorted[key] = normalize(val)
    }
  }

  return sorted
}
