import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { type ResolverObject, resolve } from './resolvers.internal.js'

/**
 * Resolves and transforms `context.params.query` using a map of resolver functions.
 * Each property in the resolver object receives the current query value and can return
 * a transformed value. Runs before `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveQuery } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   before: { find: [resolveQuery({ active: async () => true })] }
 * })
 * ```
 */
export const resolveQuery =
  <H extends HookContext>(resolverProperties: ResolverObject<any, H>) =>
  async (context: H, next?: NextFunction) => {
    const queryIngoing = context?.params?.query || {}
    const query = await resolve(resolverProperties, queryIngoing, context)

    context.params = {
      ...context.params,
      query,
    }

    if (next) {
      return next()
    }

    return context
  }
