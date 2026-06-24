import type { Query } from '@feathersjs/feathers'
import { addToQuery } from '../add-to-query/add-to-query.util.js'
import { queryHasProperty } from '../query-has-property/query-has-property.util.js'

/**
 * Adds default properties to a Feathers query — but only for fields the query does
 * not already constrain. Presence is checked with {@link queryHasProperty}, so a field
 * referenced anywhere (including nested in `$and`/`$or`/`$nor`) is left untouched and
 * the caller keeps control over it. The query is treated as the `data` equivalent of
 * the `defaults` transformer. Each default is applied independently (per-field).
 *
 * @example
 * ```ts
 * import { queryDefaults } from 'feathers-utils/utils'
 *
 * queryDefaults({ status: 'active' }, { isTemplate: false })
 * // => { status: 'active', isTemplate: false }
 *
 * queryDefaults({ $or: [{ isTemplate: true }] }, { isTemplate: false })
 * // => { $or: [{ isTemplate: true }] } (untouched — already referenced)
 * ```
 *
 * @see https://utils.feathersjs.com/utils/query-defaults.html
 */
export const queryDefaults = (
  query: Query | undefined,
  defaults: Query,
): Query => {
  const source: Query = query ?? {}

  const toAdd: Query = {}
  for (const key in defaults) {
    if (!queryHasProperty(source, key)) {
      toAdd[key] = defaults[key]
    }
  }

  return addToQuery(source, toAdd)
}
