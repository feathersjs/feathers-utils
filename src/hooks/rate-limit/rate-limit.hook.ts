import { TooManyRequests } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { RateLimiterAbstract, RateLimiterRes } from 'rate-limiter-flexible'
import { checkContext } from '../../utils/index.js'
import type { Promisable } from '../../internal.utils.js'

export type RateLimitOptions<H extends HookContext = HookContext> = {
  /** Generate the rate-limiting key. Defaults to `context.path`. */
  key?: (context: H) => Promisable<string>
  /** Number of points to consume per request. Defaults to `1`. */
  points?: (context: H) => Promisable<number>
}

/**
 * Rate limits service method calls using `rate-limiter-flexible`.
 * You provide a pre-configured `RateLimiterAbstract` instance
 * (Memory, Redis, Mongo, etc.) and the hook consumes points per request.
 *
 * @example
 * ```ts
 * import { rateLimit } from 'feathers-utils/hooks'
 * import { RateLimiterMemory } from 'rate-limiter-flexible'
 *
 * const rateLimiter = new RateLimiterMemory({ points: 10, duration: 1 })
 *
 * app.service('users').hooks({
 *   before: { find: [rateLimit(rateLimiter)] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/rate-limit.html
 */
export const rateLimit = <H extends HookContext = HookContext>(
  rateLimiter: RateLimiterAbstract,
  options?: RateLimitOptions<H>,
) => {
  const key = options?.key ?? ((context: HookContext) => context.path)
  const points = options?.points ?? (() => 1)

  return async (context: H, next?: NextFunction) => {
    checkContext(context, { type: ['before', 'around'], label: 'rateLimit' })

    const resolvedKey = await key(context)
    const resolvedPoints = await points(context)

    try {
      const res = await rateLimiter.consume(resolvedKey, resolvedPoints)
      context.params.rateLimit = res
    } catch (res) {
      context.params.rateLimit = res as RateLimiterRes
      throw new TooManyRequests('Too many requests', {
        rateLimitRes: res as RateLimiterRes,
      })
    }

    if (next) return await next()
  }
}
