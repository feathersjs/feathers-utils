import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'

/**
 * Disables pagination when `query.$limit` is `-1` or `'-1'`.
 * Removes the `$limit` from the query and sets `params.paginate = false`.
 * Must be used as a `before` or `around` hook on the `find` method.
 *
 * @example
 * ```ts
 * import { disablePagination } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { find: [disablePagination()] }
 * })
 * // Then call: app.service('users').find({ query: { $limit: -1 } })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/disable-pagination.html
 */
export const disablePagination =
  <H extends HookContext = HookContext>() =>
  (context: H, next?: NextFunction) => {
    checkContext(context, ['before', 'around'], ['find'], 'disablePagination')
    const $limit = context.params?.query?.$limit

    if ($limit === '-1' || $limit === -1) {
      context.params.paginate = false
      delete context.params.query.$limit
    }

    if (next) return next()

    return context
  }
