import type { HookContext } from '@feathersjs/feathers'
import { isMulti, isPaginated } from '../../predicates/index.js'

/**
 * Sets `context.result` to an appropriate empty value based on the hook method.
 * Returns an empty paginated object for paginated `find`, an empty array for multi
 * operations, or `null` for single-item operations. Does nothing if a result already exists.
 *
 * @example
 * ```ts
 * import { skipResult } from 'feathers-utils/utils'
 *
 * // In a before hook to skip the actual database call:
 * skipResult(context)
 * ```
 *
 * @see https://utils.feathersjs.com/utils/skip-result.html
 */
export const skipResult = <H extends HookContext = HookContext>(context: H) => {
  if (context.result) {
    return context
  }

  const multi = isMulti(context)

  if (multi) {
    if (context.method === 'find' && isPaginated(context)) {
      context.result = {
        total: 0,
        skip: 0,
        limit: 0,
        data: [],
      }
    } else {
      context.result = []
    }
  } else {
    context.result = null
  }

  return context
}
