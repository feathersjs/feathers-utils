import type { Query } from '@feathersjs/feathers'

const arrayOperators = new Set(['$or', '$and', '$nor', '$not', '$in', '$nin'])

const isPlainObjectLike = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object'

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

  if (!isPlainObjectLike(value)) {
    return value
  }

  const sorted: Record<string, any> = {}

  for (const key of Object.keys(value).sort()) {
    const val = value[key]

    if (arrayOperators.has(key) && Array.isArray(val)) {
      // Schwartzian transform: serialize each normalized element once, sort by
      // that key, then unwrap. Avoids the O(n log n) repeated JSON.stringify of
      // the previous comparator (which also returned 1 for equal elements).
      sorted[key] = val
        .map((el) => {
          const normalized = normalize(el)
          return { k: JSON.stringify(normalized), v: normalized }
        })
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
        .map((entry) => entry.v)
    } else {
      sorted[key] = normalize(val)
    }
  }

  return sorted
}
