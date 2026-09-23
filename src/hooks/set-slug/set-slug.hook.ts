import _setWith from 'lodash/setWith.js'
import _clone from 'lodash/clone.js'
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
  const targetField: string =
    typeof fieldName === 'string' ? fieldName : `query.${slug}`

  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    const value =
      context.params.provider === 'rest'
        ? context.params.route[slug]
        : undefined

    if (typeof value !== 'string' || value[0] === ':') {
      if (next) return next()
      return
    }

    // clone every object on the path, so the caller's params stay untouched
    _setWith(context, `params.${targetField}`, value, _clone)

    if (next) return next()

    return
  }
  return hook
}
