import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { ResolverObject } from './resolvers.internal.js'
import { resolve } from './resolvers.internal.js'
import { mutateData } from '../../utils/index.js'

/**
 * Resolves and transforms `context.data` using a map of resolver functions.
 * Each property in the resolver object receives the current value and can return
 * a transformed value. Runs before `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveData } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   before: { create: [resolveData({ email: async (val) => val?.toLowerCase() })] }
 * })
 * ```
 */
export const resolveData =
  <T extends Record<string, any>, H extends HookContext = HookContext>(
    resolverProperties: ResolverObject<T, H>,
  ) =>
  async (context: H, next?: NextFunction) => {
    await mutateData(context, (item) =>
      resolve(resolverProperties, item, context),
    )

    if (next) {
      return next()
    }

    return context
  }
