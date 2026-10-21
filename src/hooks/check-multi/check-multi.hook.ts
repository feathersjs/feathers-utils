import type { FeathersError } from '@feathersjs/errors'
import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { allowsMulti } from '../../common/index.js'
import { isMulti } from '../../predicates/index.js'
import type { Multi } from '../../types.js'

export type CheckMultiOptions = {
  /**
   * Which methods allow multi calls: `false` refuses every multi call, an
   * array allows them only for the listed methods.
   *
   * Defaults to the `multi` option of the service. A service that declares
   * none allows every multi call.
   *
   * @example
   * ```ts
   * import { checkMulti, iff } from 'feathers-utils/hooks'
   * import { isProvider } from 'feathers-utils/predicates'
   *
   * // refuses multi calls although the service allows them
   * checkMulti({ multi: false })
   *
   * // only for calls from clients - the server may still change many items
   * iff(isProvider('external'), checkMulti({ multi: false }))
   * ```
   */
  multi?: Multi
  /**
   * Customize the error that is thrown if the service does not allow multi operations.
   *
   * If not provided, throws a `MethodNotAllowed` error with a message indicating the operation.
   */
  error?: (context: HookContext) => FeathersError
}

/**
 * Throws a `MethodNotAllowed` error for a multi call (`create` with an array,
 * `patch`/`remove` with `id: null`) that the service's `multi` option - or the
 * hook's own `multi` - doesn't allow, before the following hooks run.
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
  const multi = options?.multi

  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    const { service, method } = context
    if (
      method === 'find' ||
      !isMulti(context) ||
      allowsMulti(service, method, multi, context.params)
    ) {
      if (next) return next()
      return
    }

    throw options?.error
      ? options.error(context)
      : new MethodNotAllowed(`Can not ${method} multiple entries`)
  }
  return hook
}
