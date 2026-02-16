import type { FeathersError } from '@feathersjs/errors'
import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { isMulti } from '../../predicates/index.js'

export type CheckMultiOptions = {
  /**
   * Customize the error that is thrown if the service does not allow multi operations.
   *
   * If not provided, throws a `MethodNotAllowed` error with a message indicating the operation.
   */
  error?: (context: HookContext) => FeathersError
}

/**
 * Checks if the `multi` option is enabled for the current method and throws a
 * `MethodNotAllowed` error if multi operations are not permitted.
 * Useful to guard against accidental bulk `create`, `patch`, or `remove` calls.
 *
 * @example
 * ```ts
 * import { checkMulti } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { create: [checkMulti()] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/check-multi.html
 */
export function checkMulti<H extends HookContext = HookContext>(
  options?: CheckMultiOptions,
) {
  return (context: H, next?: NextFunction) => {
    const { service, method } = context
    if (!service.allowsMulti || !isMulti(context) || method === 'find') {
      return context
    }

    if (!service.allowsMulti(method)) {
      throw options?.error
        ? options.error(context)
        : new MethodNotAllowed(`Can not ${method} multiple entries`)
    }

    if (next) {
      return next()
    }

    return context
  }
}
