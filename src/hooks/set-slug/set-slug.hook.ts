import _set from 'lodash/set.js'
import type { HookContext, NextFunction } from '@feathersjs/feathers'

/**
 * Extracts URL route parameters (slugs) and sets them on `params.query`.
 * For example, given a route `/stores/:storeId`, this hook copies the resolved
 * `storeId` value from `params.route` into the query. Only applies to the `rest` provider.
 *
 * @example
 * ```ts
 * import { setSlug } from 'feathers-utils/hooks'
 *
 * app.service('stores/:storeId/products').hooks({
 *   before: { all: [setSlug('storeId')] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/set-slug.html
 */
export const setSlug = <H extends HookContext = HookContext>(
  slug: string,
  fieldName?: string,
) => {
  if (typeof fieldName !== 'string') {
    fieldName = `query.${slug}`
  }

  return (context: H, next?: NextFunction) => {
    if (context.params && context.params.provider === 'rest') {
      const value = context.params.route[slug]
      if (typeof value === 'string' && value[0] !== ':') {
        _set(context.params, fieldName, value)
      }
    }

    if (next) return next()

    return context
  }
}
