import type { HookContext } from '@feathersjs/feathers'
import { getPaginate } from '../../utils/get-paginate/get-paginate.util.js'

/**
 * Checks if the current `find` operation is paginated by inspecting
 * `params.paginate` and the service's pagination options via `getPaginate`.
 * Returns `false` for all methods other than `find` or when pagination is disabled.
 *
 * @example
 * ```ts
 * import { iff, isPaginated } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   after: { find: [iff(isPaginated, addTotalCountHeader())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/is-paginated.html
 */
export const isPaginated = <H extends HookContext = HookContext>(
  context: H,
): boolean => {
  if (context.params.paginate === false || context.method !== 'find') {
    return false
  }

  const paginate = getPaginate(context)

  return !!paginate
}
