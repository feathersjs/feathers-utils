import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { resolve, type ResolverObject } from './resolvers.internal.js'
import { mutateResult } from '../../utils/index.js'

/**
 * Resolves and transforms `context.result` using a map of resolver functions.
 * Each property in the resolver object receives the current value and can return
 * a transformed value. Runs after `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveResult } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   after: { all: [resolveResult({ password: async () => undefined })] }
 * })
 * ```
 */
export const resolveResult = <
  T extends Record<string, any>,
  H extends HookContext = HookContext,
>(
  resolverProperties: ResolverObject<T, H>,
) => {
  return async (context: H, next?: NextFunction) => {
    if (next) {
      await next()
    }

    await mutateResult(context, (item) =>
      resolve(resolverProperties, item, context),
    )

    return
  }
}
