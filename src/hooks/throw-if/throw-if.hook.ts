import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'
import { BadRequest } from '@feathersjs/errors'
import type { FeathersError } from '@feathersjs/errors'

export type ThrowIfOptions = {
  /**
   * Customize the error that is thrown if the predicate returns true.
   *
   * If not provided, throws a `BadRequest` error with 'Invalid operation'.
   */
  error?: (context: HookContext) => FeathersError
}

/**
 * Throw an error if the predicate function returns true.
 *
 * This hook is useful for validating conditions before proceeding with the request.
 *
 * @see https://utils.feathersjs.com/hooks/throw-if.html
 */
export const throwIf = <H extends HookContext = HookContext>(
  predicate: PredicateFn,
  options?: ThrowIfOptions,
) => {
  return async (context: H, next?: NextFunction) => {
    const result = await predicate(context)

    if (result) {
      throw options?.error
        ? options.error(context)
        : new BadRequest('Invalid operation')
    }

    if (next) {
      return await next()
    }
  }
}
