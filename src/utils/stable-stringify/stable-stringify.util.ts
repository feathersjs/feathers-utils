import { sortQueryProperties } from '../sort-query-properties/sort-query-properties.util.js'

/**
 * Serializes an object into a deterministic, order-independent string — useful
 * for cache keys. Canonicalizes the object once via {@link sortQueryProperties}
 * (recursive key-sort + operator-array sort) so that `{ a: 1, b: 2 }` and
 * `{ b: 2, a: 1 }` (and `{ $in: [1, 2] }` vs `{ $in: [2, 1] }`) produce the same
 * string. Throws on non-JSON values (functions).
 *
 * @example
 * ```ts
 * import { stableStringify } from 'feathers-utils/utils'
 *
 * stableStringify({ b: 2, a: 1 }) === stableStringify({ a: 1, b: 2 }) // true
 * ```
 *
 * @see https://utils.feathersjs.com/utils/stable-stringify.html
 */
export const stableStringify = (obj: Record<string, any>) => {
  // Canonicalize the whole params object once (recursive key-sort + operator-array
  // sort). The JSON.stringify pass then only needs to reject non-JSON values
  // instead of re-sorting and re-allocating every node.
  const normalized = sortQueryProperties(obj as any)

  return JSON.stringify(normalized, (_key, value) => {
    if (typeof value === 'function') {
      throw new Error('Cannot stringify non JSON value')
    }
    return value
  })
}
