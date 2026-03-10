import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { resolve, type ResolverObject } from '../resolvers.internal.js'
import { mutateResult } from '../../utils/index.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'
import type { AnyFallback, Promisable } from '../../internal.utils.js'

type Result<H extends HookContext> = AnyFallback<
  ResultSingleHookContext<H>,
  Record<string, any>
>

/**
 * Resolves and transforms `context.result` using a map of resolver functions.
 * Each property in the resolver object receives the current value and can return
 * a transformed value. Runs after `next()` in the hook pipeline.
 *
 * @example
 * ```ts
 * import { resolveResult, omit } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   after: {
 *     all: [resolveResult({ password: omit() })]
 *   }
 * })
 * ```
 */
export const resolveResult = <H extends HookContext = HookContext>(
  resolvers: ResolverObject<Result<H>, H>,
): {
  (context: H, next: NextFunction): Promise<void>
  (context: H): Promisable<void>
} => {
  const propertyNames = Object.keys(resolvers) as any as (keyof Result<H>)[]

  if (!propertyNames.length) {
    return ((context: H, next?: NextFunction) => {
      if (next) return next()
    }) as any
  }

  return ((context: H, next?: NextFunction) => {
    function run(): Promisable<void> {
      const result = mutateResult(context, (item, { i }) =>
        resolve({ resolvers, data: item, context, propertyNames, i }),
      )
      if (result instanceof Promise) return result.then(() => {})
      return
    }

    if (next) {
      return next().then(run)
    }

    return run()
  }) as any
}
