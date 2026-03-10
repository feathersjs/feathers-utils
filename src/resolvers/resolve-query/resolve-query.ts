import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { type ResolverObject, resolve } from '../resolvers.internal.js'
import type { Promisable } from '../../internal.utils.js'

/**
 * Resolves and transforms `context.params.query` using a map of resolver functions.
 * Each property in the resolver object receives the current query value and can return
 * a transformed value. Runs before `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveQuery, defaults } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   before: {
 *     find: [resolveQuery({ active: defaults(true) })]
 *   }
 * })
 * ```
 */
export const resolveQuery = <H extends HookContext>(
  resolvers: ResolverObject<any, H>,
): {
  (context: H, next: NextFunction): Promise<void>
  (context: H): Promisable<H>
} => {
  const propertyNames = Object.keys(resolvers) as any as (keyof any)[]

  if (!propertyNames.length) {
    return ((context: H, next?: NextFunction) => {
      if (next) return next().then(() => context)
      return context
    }) as any
  }

  return ((context: H, next?: NextFunction) => {
    const queryIngoing = context?.params?.query || {}
    const result = resolve({ resolvers, data: queryIngoing, context, propertyNames })

    function assign(query: any) {
      context.params = { ...context.params, query }
      if (next) return next().then(() => context)
      return context
    }

    if (result instanceof Promise) {
      return result.then(assign)
    }

    return assign(result)
  }) as any
}
