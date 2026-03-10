import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { ResolverObject } from '../resolvers.internal.js'
import { resolve } from '../resolvers.internal.js'
import { mutateData } from '../../utils/index.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'
import type { AnyFallback, Promisable } from '../../internal.utils.js'

type Data<H extends HookContext> = AnyFallback<
  DataSingleHookContext<H>,
  Record<string, any>
>

/**
 * Resolves and transforms `context.data` using a map of resolver functions.
 * Each property in the resolver object receives the current value and can return
 * a transformed value. Runs before `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveData, lowercase } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   before: {
 *     create: [resolveData({ email: lowercase() })]
 *   }
 * })
 * ```
 */
export const resolveData = <H extends HookContext = HookContext>(
  resolvers: ResolverObject<Data<H>, H>,
): {
  (context: H, next: NextFunction): Promise<void>
  (context: H): Promisable<H>
} => {
  const propertyNames = Object.keys(resolvers) as any as (keyof Data<H>)[]

  if (!propertyNames.length) {
    return ((context: H, next?: NextFunction) => {
      if (next) return next().then(() => context)
      return context
    }) as any
  }

  return ((context: H, next?: NextFunction) => {
    const result = mutateData(context, (item, { i }) =>
      resolve({ resolvers, data: item, context, propertyNames, i }),
    )

    if (result instanceof Promise) {
      return next ? result.then(() => next()).then(() => context) : result
    }

    if (next) return next().then(() => context)
    return result
  }) as any
}
