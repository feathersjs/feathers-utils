import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'
import type { Promisable } from '../../internal.utils.js'
import type { ThrottleAbstract } from './throttle.types.js'

export type ThrottleOptions<H extends HookContext = HookContext> = {
  /** Generate the throttle key. Defaults to `context.path`. */
  key?: (context: H) => Promisable<string>
}

/**
 * Throttles outbound work by routing each service call through a pluggable
 * {@link ThrottleAbstract}. Unlike `rateLimit`, which rejects calls that
 * exceed a budget, `throttle` queues them and waits until capacity frees up
 * (with optional hard ceilings on queue size and wait time).
 *
 * Must be registered as an `around` hook so it can hold the slot for the
 * full duration of the downstream service call.
 *
 * @example
 * ```ts
 * import { throttle, MemoryThrottle } from 'feathers-utils/hooks'
 *
 * const throttler = new MemoryThrottle({
 *   maxConcurrent: 5,
 *   reservoir: 600,
 *   reservoirIntervalMs: 60_000,
 * })
 *
 * app.service('weather').hooks({
 *   around: { find: [throttle(throttler)] },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/throttle.html
 */
export const throttle = <H extends HookContext = HookContext>(
  throttler: ThrottleAbstract,
  options?: ThrottleOptions<H>,
) => {
  const key = options?.key ?? ((context: HookContext) => context.path)

  return async (context: H, next?: NextFunction) => {
    checkContext(context, { type: ['around'], label: 'throttle' })

    if (!next) {
      throw new Error('The `throttle` hook must be used as an around hook.')
    }

    const resolvedKey = await key(context)

    await throttler.schedule(resolvedKey, async () => {
      await next()
    })
  }
}
