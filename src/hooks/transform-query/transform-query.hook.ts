import type { HookContext, NextFunction, Query } from '@feathersjs/feathers'
import type { TransformerFn } from '../../types.js'

/**
 * Transforms `context.params.query` using the provided transformer function.
 * The transformer receives a shallow copy of the query, which it can change in
 * place (e.g. with `lowercase`) or replace by returning a new query.
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
  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    // a copy, so a transformer that changes the query in place (like
    // `lowercase`) does not write into the caller's params
    const query = { ...context.params.query }
    const result = transformer(query, { context, i: 0 })

    context.params = { ...context.params, query: result ?? query }

    if (next) return next()

    return
  }
  return hook
}
