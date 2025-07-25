import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'

/**
 * Disables pagination when `query.$limit` is `-1` or `'-1'`.
 *
 * @see https://utils.feathersjs.com/hooks/disable-pagination.html
 */
export const disablePagination =
  <H extends HookContext = HookContext>() =>
  (context: H, next?: NextFunction) => {
    checkContext(context, 'before', ['find'], 'disablePagination')
    const $limit = context.params?.query?.$limit

    if ($limit === '-1' || $limit === -1) {
      context.params.paginate = false
      delete context.params.query.$limit
    }

    if (next) return next().then(() => context)

    return context
  }
