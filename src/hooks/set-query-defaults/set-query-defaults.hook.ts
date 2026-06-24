import type { HookContext, NextFunction, Query } from '@feathersjs/feathers'
import { queryDefaults } from '../../utils/query-defaults/query-defaults.util.js'

/**
 * Adds default properties to `context.params.query` for fields the incoming query does
 * not already constrain (including fields referenced nested in `$and`/`$or`/`$nor`).
 * The query equivalent of the `defaults` transformer: e.g. hide template rows by default
 * while still letting callers opt in via `{ isTemplate: true }`. This is the same pattern
 * `softDelete` uses to filter out deleted rows. Works as a `before` or `around` hook.
 *
 * @example
 * ```ts
 * import { setQueryDefaults } from 'feathers-utils/hooks'
 *
 * app.service('posts').hooks({
 *   before: { all: [setQueryDefaults({ isTemplate: false })] },
 * })
 * // find() => filters out templates
 * // find({ query: { isTemplate: true } }) => caller keeps control
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/set-query-defaults.html
 */
export const setQueryDefaults = <H extends HookContext = HookContext>(
  defaults: Query,
) => {
  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    context.params.query = queryDefaults(context.params.query, defaults)

    if (next) return next()

    return
  }
  return hook
}
