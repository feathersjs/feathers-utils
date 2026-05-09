import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { Promisable } from '../../internal.utils.js'
import { MemoryThrottle } from '../throttle/memory-throttle.js'
import { throttle } from '../throttle/throttle.hook.js'
import type { ThrottleAbstract } from '../throttle/throttle.types.js'

export type LockOptions<H extends HookContext = HookContext> = {
  /** Generate the lock key. Required — locking the entire service is almost always wrong. */
  key: (context: H) => Promisable<string>
  /** Max time in milliseconds a task may wait for the lock before being rejected with `Timeout`. */
  timeoutMs?: number
}

export type LockOptionsWithThrottler<H extends HookContext = HookContext> = {
  /** Generate the lock key. */
  key: (context: H) => Promisable<string>
}

/**
 * Per-key mutex hook. While a task holds the lock for a given key, any other
 * task that resolves to the same key waits in FIFO order. Built on top of
 * {@link throttle} with `maxConcurrent: 1`.
 *
 * Two forms:
 *
 * 1. **Standalone** — pass options only. Each `lock(...)` call creates its own
 *    in-memory `MemoryThrottle`, so two registrations do *not* share a lock
 *    even with the same key.
 *
 *    ```ts
 *    lock({ key: (ctx) => `${ctx.path}:${ctx.id}` })
 *    ```
 *
 * 2. **Shared** — pass a pre-built {@link ThrottleAbstract} so multiple
 *    registrations (or services) coordinate through the same lock space.
 *    Use this when, e.g., two different services must not run concurrently
 *    for the same record id.
 *
 *    ```ts
 *    const locks = new MemoryThrottle({ maxConcurrent: 1 })
 *    app.service('orders').hooks({ around: { patch: [lock(locks, { key: ... })] } })
 *    app.service('invoices').hooks({ around: { patch: [lock(locks, { key: ... })] } })
 *    ```
 *
 * @see https://utils.feathersjs.com/hooks/lock.html
 */
export function lock<H extends HookContext = HookContext>(
  options: LockOptions<H>,
): (context: H, next?: NextFunction) => Promise<void>
export function lock<H extends HookContext = HookContext>(
  throttler: ThrottleAbstract,
  options: LockOptionsWithThrottler<H>,
): (context: H, next?: NextFunction) => Promise<void>
export function lock<H extends HookContext = HookContext>(
  throttlerOrOptions: ThrottleAbstract | LockOptions<H>,
  maybeOptions?: LockOptionsWithThrottler<H>,
) {
  let throttler: ThrottleAbstract
  let key: (context: H) => Promisable<string>

  if (maybeOptions !== undefined) {
    throttler = throttlerOrOptions as ThrottleAbstract
    key = maybeOptions.key
  } else {
    const options = throttlerOrOptions as LockOptions<H>
    throttler = new MemoryThrottle({
      maxConcurrent: 1,
      queueTimeoutMs: options.timeoutMs ?? Infinity,
    })
    key = options.key
  }

  return throttle<H>(throttler, { key })
}
