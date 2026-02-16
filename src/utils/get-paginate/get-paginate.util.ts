import type { PaginationOptions } from '@feathersjs/adapter-commons'
import type { HookContext } from '@feathersjs/feathers'
import { hasOwnProperty } from '../../internal.utils.js'

/**
 * Resolves the active pagination options for the current hook context.
 * Checks (in order): `context.params.paginate`, `service.options.paginate`,
 * and `context.params.adapter.paginate`. Returns `undefined` if pagination is disabled.
 *
 * @example
 * ```ts
 * import { getPaginate } from 'feathers-utils/utils'
 *
 * const paginate = getPaginate(context)
 * if (paginate) {
 *   console.log('Max items:', paginate.max)
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-paginate.html
 */
export const getPaginate = <H extends HookContext = HookContext>(
  context: H,
): PaginationOptions | undefined => {
  if (hasOwnProperty(context.params, 'paginate')) {
    return (context.params.paginate as PaginationOptions) || undefined
  }

  if (context.params.paginate === false) {
    return undefined
  }
  let options = context.service?.options || {}

  options = {
    ...options,
    ...context.params.adapter,
  }

  return options.paginate || undefined
}
