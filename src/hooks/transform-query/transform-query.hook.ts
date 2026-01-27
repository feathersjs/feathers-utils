import type { HookContext, NextFunction, Query } from '@feathersjs/feathers'
import type { TransformerFn } from '../../types.js'

/**
 * Transforms the query object.
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
