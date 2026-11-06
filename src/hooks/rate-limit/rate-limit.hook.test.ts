import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { rateLimit } from './rate-limit.hook.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

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

  describe('headers', () => {
    const contextFor = (http?: { headers: Record<string, string> }): any => ({
      type: 'before',
      method: 'find',
      path: 'users',
      params: {},
      ...(http ? { http } : {}),
    })

    it('sends none unless asked to', async () => {
      const context = contextFor()

      await rateLimit(new RateLimiterMemory({ points: 5, duration: 60 }))(
        context,
      )

      expect(context.http).toBeUndefined()
    })

    it('reports the limit in each format, keeping headers already set', async () => {
      const send = async (headers: any) => {
        const context = contextFor({ headers: { 'X-Other': 'kept' } })
        await rateLimit(new RateLimiterMemory({ points: 5, duration: 60 }), {
          headers,
        })(context)
        return context.http.headers
      }

      expect(await send('legacy')).toEqual({
        'X-Other': 'kept',
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Reset': expect.stringMatching(/^\d{10}$/),
      })
      expect(await send('draft-6')).toMatchObject({
        'RateLimit-Policy': '5;w=60',
        'RateLimit-Limit': '5',
        'RateLimit-Remaining': '4',
        'RateLimit-Reset': '60',
      })
      expect(await send('draft-7')).toMatchObject({
        'RateLimit-Policy': '5;w=60',
        RateLimit: 'limit=5, remaining=4, reset=60',
      })
      expect(await send('draft-8')).toMatchObject({
        'RateLimit-Policy': '"5-in-60sec";q=5;w=60',
        RateLimit: '"5-in-60sec";r=4;t=60',
      })
    })

    it('takes headers of your own', async () => {
      const context = contextFor()

      await rateLimit(new RateLimiterMemory({ points: 5, duration: 60 }), {
        headers: ({ remaining, limited }) => ({
          'X-Requests-Left': `${remaining}`,
          'X-Limited': `${limited}`,
        }),
      })(context)

      expect(context.http.headers).toEqual({
        'X-Requests-Left': '4',
        'X-Limited': 'false',
      })
    })

    it('hands a rejection the headers with Retry-After, also on the error', async () => {
      const rateLimiter = new RateLimiterMemory({ points: 1, duration: 60 })
      const hook = rateLimit(rateLimiter, { headers: 'draft-7' })
      await hook(contextFor())
      const context = contextFor()

      const error: any = await hook(context).catch((error) => error)

      const expected = {
        'RateLimit-Policy': '1;w=60',
        RateLimit: 'limit=1, remaining=0, reset=60',
        'Retry-After': '60',
      }
      expect(context.http.headers).toEqual(expected)
      expect(error.data).toMatchObject({ retryAfter: 60, headers: expected })
    })

    it('tells how long to wait even without headers', async () => {
      const hook = rateLimit(new RateLimiterMemory({ points: 1, duration: 30 }))
      await hook(contextFor())

      const error: any = await hook(contextFor()).catch((error) => error)

      expect(error.data.retryAfter).toBe(30)
      expect(error.data.headers).toBeUndefined()
    })
  })

  describe('dryRun and onLimited', () => {
    const contextFor = (params: Record<string, unknown> = {}): any => ({
      type: 'before',
      method: 'find',
      path: 'users',
      params,
    })

    it('lets a call over the limit through, with the headers but nothing to wait for', async () => {
      const onLimited = vi.fn()
      const hook = rateLimit(
        new RateLimiterMemory({ points: 1, duration: 60 }),
        {
          dryRun: true,
          onLimited,
          headers: 'draft-7',
        },
      )
      await hook(contextFor())
      expect(onLimited).not.toHaveBeenCalled()
      const context = { ...contextFor(), type: 'around' }
      const next = vi.fn()

      await hook(context, next)

      expect(next).toHaveBeenCalledOnce()
      expect(context.http.headers).toEqual({
        'RateLimit-Policy': '1;w=60',
        RateLimit: 'limit=1, remaining=0, reset=60',
      })
      // the call over the limit consumed its point too
      expect(context.params.rateLimit.consumedPoints).toBe(2)
      expect(onLimited).toHaveBeenCalledOnce()
      expect(onLimited.mock.calls[0][0]).toEqual({
        limit: 1,
        remaining: 0,
        reset: 60,
        window: 60,
        limited: true,
      })
      expect(onLimited.mock.calls[0][1]).toBe(context)
    })

    it('decides per call with a predicate', async () => {
      const rateLimiter = new RateLimiterMemory({ points: 1, duration: 60 })
      const hook = rateLimit(rateLimiter, {
        key: 'shared',
        dryRun: (context) => context.params.trial === true,
      })
      await hook(contextFor())

      await expect(hook(contextFor({ trial: true }))).resolves.toBeUndefined()
      await expect(hook(contextFor())).rejects.toThrow('Too many requests')
    })

    it('tells onLimited of a rejection too, before it throws', async () => {
      const onLimited = vi.fn()
      const hook = rateLimit(
        new RateLimiterMemory({ points: 1, duration: 60 }),
        {
          onLimited,
        },
      )
      await hook(contextFor())

      await expect(hook(contextFor())).rejects.toThrow('Too many requests')
      expect(onLimited).toHaveBeenCalledOnce()
      expect(onLimited.mock.calls[0][0]).toMatchObject({
        limited: true,
        remaining: 0,
      })
    })

    it('rejects when the store fails, dry run or not', async () => {
      const onLimited = vi.fn()
      const failing = new RateLimiterMemory({ points: 1, duration: 60 })
      failing.consume = () => Promise.reject(new Error('store down'))

      await expect(
        rateLimit(failing, { dryRun: true, onLimited })(contextFor()),
      ).rejects.toThrow('Too many requests')
      expect(onLimited).not.toHaveBeenCalled()
    })
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

  it('does not mutate params', async () => {
    const remaining = await expectNoSideEffects(
      { query: { name: 'Jane' } },
      async (params) => {
        const hook = rateLimit(
          new RateLimiterMemory({ points: 1, duration: 60 }),
        )
        const allowed = {
          type: 'before',
          method: 'find',
          path: 'users',
          params,
        } as any
        const limited = {
          type: 'before',
          method: 'find',
          path: 'users',
          params,
        } as any

        await hook(allowed)
        await expect(hook(limited)).rejects.toThrow('Too many requests')

        return [allowed, limited].map(
          (context) => context.params.rateLimit.remainingPoints,
        )
      },
    )
    expect(remaining).toEqual([0, 0])
  })
})
