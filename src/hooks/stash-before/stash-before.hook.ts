import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'

/**
 * Stashes the current value of a record into `params.before` prior to mutation.
 * Performs a `get` (single item) or `find` (multi) call to retrieve the existing state.
 * Useful in `update`, `patch`, or `remove` hooks when you need the original data for comparison.
 *
 * @example
 * ```ts
 * import { stashBefore } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { patch: [stashBefore()] }
 * })
 * // Access via: context.params.before
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/stash-before.html
 */
export function stashBefore<H extends HookContext = HookContext>(
  fieldName?: string,
) {
  const beforeField = fieldName || 'before'

  return async (context: H, next?: NextFunction) => {
    if (context.params.disableStashBefore) {
      return context
    }

    checkContext(
      context,
      ['before', 'around'],
      ['update', 'patch', 'remove'],
      'stashBefore',
    )

    const isMulti = context.id == null

    const params = {
      ...context.params,
      disableStashBefore: true,
      ...(isMulti ? { paginate: false } : {}),
    }

    await (
      !isMulti
        ? context.service.get(context.id, params)
        : context.service.find(params)
    )
      .then((result: any) => {
        context.params[beforeField] = result
        return context
      })
      .catch(() => {
        return context
      })

    if (next) {
      return await next()
    }

    return context
  }
}
