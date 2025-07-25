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
 * Check if the 'multi' option is set for a method. You can use this to early throw an error if 'multi' is not set.
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
