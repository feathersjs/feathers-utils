import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { TransportName } from '../../types.js'
import { isProvider } from '../../predicates/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

/**
 * Prevents access to a service method completely or for specific transports.
 * When called without arguments, the method is blocked for all callers.
 * When called with transport names, only those transports are blocked.
 *
 * @example
 * ```ts
 * import { disallow } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: {
 *     remove: [disallow('external')], // block external access
 *     update: [disallow()],           // block completely
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/disallow.html
 */
export const disallow = <H extends HookContext = HookContext>(
  transports?: MaybeArray<TransportName>,
) => {
  const transportsArr = toArray(transports)
  return (context: H, next?: NextFunction) => {
    if (!transports) {
      throw new MethodNotAllowed('Method not allowed')
    }

    if (isProvider(...(transportsArr as TransportName[]))(context)) {
      throw new MethodNotAllowed(
        `Provider '${context.params.provider}' can not call '${context.method}'. (disallow)`,
      )
    }

    if (next) return next().then(() => context)
  }
}
