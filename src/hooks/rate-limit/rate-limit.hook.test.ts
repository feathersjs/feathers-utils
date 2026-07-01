import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { rateLimit } from './rate-limit.hook.js'

describe('hook - rateLimit', () => {
  it('passes through when under limit and sets context.params.rateLimit', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 5, duration: 1 })

    await rateLimit(rateLimiter)(context)

    expect(context.params.rateLimit).toBeDefined()
    expect(context.params.rateLimit.remainingPoints).toBe(4)
    expect(context.params.rateLimit.consumedPoints).toBe(1)
  })

  it('throws TooManyRequests when limit is exceeded', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    await rateLimit(rateLimiter)(context)

    await expect(rateLimit(rateLimiter)(context)).rejects.toThrow(
      'Too many requests',
    )
  })

  it('sets context.params.rateLimit even on rejection', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    await rateLimit(rateLimiter)(context)

    try {
      await rateLimit(rateLimiter)(context)
    } catch {
      // expected
    }

    expect(context.params.rateLimit).toBeDefined()
  })

  it('uses custom key', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    // With random keys, each request gets its own bucket
    const key = () => Math.random().toString()

    await rateLimit(rateLimiter, { key })(context)
    await expect(
      rateLimit(rateLimiter, { key })(context),
    ).resolves.not.toThrow()
  })

  it('uses custom points', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    // Consuming 2 points against a 1-point limit should fail immediately
    const points = () => 2

    await expect(rateLimit(rateLimiter, { points })(context)).rejects.toThrow(
      'Too many requests',
    )
  })

  it('uses a static string key as a shared bucket', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    // Both requests share the same static bucket, so the second is rejected
    await rateLimit(rateLimiter, { key: 'global' })(context)
    await expect(
      rateLimit(rateLimiter, { key: 'global' })(context),
    ).rejects.toThrow('Too many requests')
  })

  it('uses static number points', async () => {
    const context: any = {
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 1, duration: 1 })

    // Consuming 2 points against a 1-point limit should fail immediately
    await expect(
      rateLimit(rateLimiter, { points: 2 })(context),
    ).rejects.toThrow('Too many requests')
  })

  it('throws when used in an after hook', async () => {
    const context: any = {
      type: 'after',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 5, duration: 1 })

    await expect(rateLimit(rateLimiter)(context)).rejects.toThrow()
  })

  it('calls next() for around hooks', async () => {
    const context: any = {
      type: 'around',
      method: 'find',
      path: 'users',
      params: {},
    }
    const rateLimiter = new RateLimiterMemory({ points: 5, duration: 1 })
    const next = vi.fn()

    await rateLimit(rateLimiter)(context, next)

    expect(next).toHaveBeenCalledOnce()
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      const rateLimiter = new RateLimiterMemory({ points: 5, duration: 1 })
      expectTypeOf(rateLimit<Ctx>(rateLimiter)).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('rejects with TooManyRequests after exceeding limit', async () => {
      const rateLimiter = new RateLimiterMemory({ points: 1, duration: 60 })
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())
      app.service('items').hooks({
        around: {
          find: [rateLimit<Ctx>(rateLimiter)],
        },
      })

      await app.service('items').find()
      await expect(app.service('items').find()).rejects.toThrow(
        /Too many requests/,
      )
    })
  })
})
