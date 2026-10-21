import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { TransportName } from '../../types.js'
import { isProvider } from '../../predicates/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../common/index.js'

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
  // built once; `isProvider` throws for an empty list, which blocks anyway
  const fromProvider =
    transports && transportsArr.length
      ? isProvider(...(transportsArr as TransportName[]))
      : undefined
  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    // No transports (undefined) or an empty list means "block completely".
    // Fail closed for a guard hook rather than throwing a confusing internal error.
    if (!fromProvider) {
      throw new MethodNotAllowed('Method not allowed')
    }

    if (fromProvider(context)) {
      throw new MethodNotAllowed(
        `Provider '${context.params.provider}' can not call '${context.method}' on '${context.path}'. (disallow)`,
      )
    }

    if (next) return next()

    return
  }
  return hook
}
