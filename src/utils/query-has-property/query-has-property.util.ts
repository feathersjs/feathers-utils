import type { Query } from '@feathersjs/feathers'
import { toArray, type MaybeArray } from '../../internal.utils.js'
import { walkQuery } from '../walk-query/walk-query.util.js'

/**
 * Checks whether a Feathers query contains one or more properties — including
 * properties nested inside `$and`/`$or`/`$nor` arrays. Returns `true` as soon as
 * any of the given property names is found. The query is not mutated.
 *
 * @example
 * ```ts
 * import { queryHasProperty } from 'feathers-utils/utils'
 *
 * queryHasProperty({ isTemplate: true }, 'isTemplate') // true
 * queryHasProperty({ $or: [{ isTemplate: true }] }, 'isTemplate') // true
 * queryHasProperty({ age: { $gt: 18 } }, ['isTemplate', 'status']) // false
 * ```
 *
 * @see https://utils.feathersjs.com/utils/query-has-property.html
 */
export const queryHasProperty = (
  query: Query,
  property: MaybeArray<string>,
): boolean => {
  const properties = new Set(toArray(property))

  let found = false
  walkQuery(query, ({ property: key, stop }) => {
    if (properties.has(key)) {
      found = true
      stop()
    }
    // returning undefined leaves the value untouched → no mutation
  })

  return found
}
