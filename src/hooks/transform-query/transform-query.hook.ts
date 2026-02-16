import type { HookContext, NextFunction, Query } from '@feathersjs/feathers'
import type { TransformerFn } from '../../types.js'

/**
 * Transforms `context.params.query` using the provided transformer function.
 * The transformer receives the current query and can return a modified version.
 * Useful for normalizing, sanitizing, or enriching queries before they hit the database.
 *
 * @example
 * ```ts
 * import { transformQuery } from 'feathers-utils/transformers'
 *
 * app.service('users').hooks({
 *   before: { find: [transformQuery((query) => ({ ...query, active: true }))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/transform-query.html
 */
export const transformQuery = <
  Q extends Query,
  H extends HookContext = HookContext,
>(
  transformer: TransformerFn<Q, H>,
) => {
  return (context: H, next?: NextFunction) => {
    context.params.query = transformer(context.params.query ?? {}, {
      context,
      i: 0,
    })

    if (next) {
      return next().then(() => context)
    }

    return context
  }
}
