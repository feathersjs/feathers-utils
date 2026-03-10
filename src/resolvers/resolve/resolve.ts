import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { ResolverObject } from '../resolvers.internal.js'
import { resolveData } from '../resolve-data/resolve-data.js'
import { resolveQuery } from '../resolve-query/resolve-query.js'
import { resolveResult } from '../resolve-result/resolve-result.js'
import type {
  DataSingleHookContext,
  ResultSingleHookContext,
} from '../../utility-types/hook-context.js'
import type { AnyFallback } from '../../internal.utils.js'

type Data<H extends HookContext> = AnyFallback<
  DataSingleHookContext<H>,
  Record<string, any>
>

type Result<H extends HookContext> = AnyFallback<
  ResultSingleHookContext<H>,
  Record<string, any>
>

/**
 * Combines `data`, `query`, and `result` resolvers into a single around hook.
 * Data and query resolvers run before `next()`, while the result resolver runs after.
 * At least one resolver must be provided.
 *
 * @example
 * ```ts
 * import { resolve, lowercase, omit } from 'feathers-utils/resolvers'
 *
 * app.service('users').hooks({
 *   around: {
 *     all: [resolve({
 *       data: { email: lowercase() },
 *       result: { password: omit() },
 *     })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/resolvers/resolve.html
 */
export const resolve = <
  H extends HookContext = HookContext,
>(resolverProperties: {
  data?: ResolverObject<Data<H>, H>
  query?: ResolverObject<any, H>
  result?: ResolverObject<Result<H>, H>
}) => {
  const dataResolver = resolverProperties.data
    ? resolveData(resolverProperties.data)
    : undefined
  const queryResolver = resolverProperties.query
    ? resolveQuery(resolverProperties.query)
    : undefined
  const resultResolver = resolverProperties.result
    ? resolveResult(resolverProperties.result)
    : undefined

  if (!dataResolver && !queryResolver && !resultResolver) {
    throw new Error(
      'At least one resolver must be provided (data, query, or result)',
    )
  }

  return async (context: H, next?: NextFunction) => {
    if (queryResolver || dataResolver) {
      const promisesBefore: Promise<any>[] = []

      if (queryResolver) {
        promisesBefore.push(Promise.resolve(queryResolver(context)))
      }

      if (dataResolver) {
        promisesBefore.push(Promise.resolve(dataResolver(context)))
      }

      await Promise.all(promisesBefore)
    }

    if (next) {
      await next()
    }

    if (resultResolver) {
      await resultResolver(context)
    }

    return
  }
}
