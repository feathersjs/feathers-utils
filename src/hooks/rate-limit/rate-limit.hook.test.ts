import { describe, it, expect, vi } from 'vitest'
import { RateLimiterMemory } from 'rate-limiter-flexible'
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
})
