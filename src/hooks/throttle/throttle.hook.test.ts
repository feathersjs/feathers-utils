import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { throttle } from './throttle.hook.js'
import { MemoryThrottle } from './memory-throttle.js'

const makeContext = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'around',
    method: 'find',
    path: 'users',
    params: {},
    ...overrides,
  }) as any

const deferred = <T = void>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Lets queued microtasks run.
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

describe('hook - throttle', () => {
  it('passes through and calls next() when under limits', async () => {
    const throttler = new MemoryThrottle({ maxConcurrent: 5 })
    const context = makeContext()
    const next = vi.fn().mockResolvedValue(undefined)

    await throttle(throttler)(context, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('throws when used in a before hook', async () => {
    const throttler = new MemoryThrottle()
    const context = makeContext({ type: 'before' })
    const next = vi.fn().mockResolvedValue(undefined)

    await expect(throttle(throttler)(context, next)).rejects.toThrow()
  })

  it('throws when used in an after hook', async () => {
    const throttler = new MemoryThrottle()
    const context = makeContext({ type: 'after' })
    const next = vi.fn().mockResolvedValue(undefined)

    await expect(throttle(throttler)(context, next)).rejects.toThrow()
  })

  it('throws if no next is provided (not an around hook)', async () => {
    const throttler = new MemoryThrottle()
    const context = makeContext()

    await expect(throttle(throttler)(context)).rejects.toThrow()
  })

  it('uses a custom key resolver', async () => {
    const throttler = new MemoryThrottle({ maxConcurrent: 1 })
    const context = makeContext({ params: { user: { id: 42 } } })
    const next = vi.fn().mockResolvedValue(undefined)

    await throttle(throttler, {
      key: (ctx: any) => `${ctx.path}:${ctx.params.user.id}`,
    })(context, next)

    expect(next).toHaveBeenCalledOnce()
  })

  describe('maxConcurrent', () => {
    it('runs at most `maxConcurrent` tasks in parallel and queues the rest', async () => {
      const throttler = new MemoryThrottle({ maxConcurrent: 2 })

      const gates = [deferred(), deferred(), deferred(), deferred()]
      const nexts = gates.map((g) => vi.fn().mockReturnValue(g.promise))

      const calls = nexts.map((n) =>
        throttle(throttler)(makeContext(), n as any),
      )

      await flush()
      // Only the first two should have started.
      expect(nexts[0]).toHaveBeenCalled()
      expect(nexts[1]).toHaveBeenCalled()
      expect(nexts[2]).not.toHaveBeenCalled()
      expect(nexts[3]).not.toHaveBeenCalled()

      // Finish the first task — third should now start.
      gates[0].resolve()
      await flush()
      expect(nexts[2]).toHaveBeenCalled()
      expect(nexts[3]).not.toHaveBeenCalled()

      // Finish the second — fourth starts.
      gates[1].resolve()
      await flush()
      expect(nexts[3]).toHaveBeenCalled()

      gates[2].resolve()
      gates[3].resolve()
      await Promise.all(calls)
    })

    it('releases the slot when the wrapped task throws', async () => {
      const throttler = new MemoryThrottle({ maxConcurrent: 1 })

      const failing = vi.fn().mockRejectedValue(new Error('boom'))
      await expect(
        throttle(throttler)(makeContext(), failing as any),
      ).rejects.toThrow('boom')

      // Slot should be free again — second call must run.
      const success = vi.fn().mockResolvedValue(undefined)
      await throttle(throttler)(makeContext(), success as any)
      expect(success).toHaveBeenCalledOnce()
    })
  })

  describe('maxQueueSize', () => {
    it('rejects with TooManyRequests when the queue is full', async () => {
      const throttler = new MemoryThrottle({
        maxConcurrent: 1,
        maxQueueSize: 1,
      })

      const gateRunning = deferred()
      const gateQueued = deferred()

      const running = throttle(throttler)(
        makeContext(),
        (() => gateRunning.promise) as any,
      )
      const queued = throttle(throttler)(
        makeContext(),
        (() => gateQueued.promise) as any,
      )

      await flush()

      // Third call has nowhere to wait — the single queue slot is taken.
      await expect(
        throttle(throttler)(makeContext(), (() => deferred().promise) as any),
      ).rejects.toThrow('Throttle queue is full')

      gateRunning.resolve()
      gateQueued.resolve()
      await Promise.all([running, queued])
    })
  })

  describe('reservoir / token bucket', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('throws if reservoir is set without reservoirIntervalMs', () => {
      expect(() => new MemoryThrottle({ reservoir: 5 })).toThrow()
    })

    it('refills tokens after the configured interval', async () => {
      const throttler = new MemoryThrottle({
        reservoir: 2,
        reservoirIntervalMs: 1000,
      })

      const nexts = [
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue(undefined),
        vi.fn().mockResolvedValue(undefined),
      ]

      const calls = nexts.map((n) =>
        throttle(throttler)(makeContext(), n as any),
      )

      await flush()
      // First two consume the reservoir; third waits for refill.
      expect(nexts[0]).toHaveBeenCalled()
      expect(nexts[1]).toHaveBeenCalled()
      expect(nexts[2]).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)
      await flush()

      expect(nexts[2]).toHaveBeenCalled()
      await Promise.all(calls)
    })
  })

  describe('queueTimeoutMs', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects waiting tasks with Timeout when they wait too long', async () => {
      const throttler = new MemoryThrottle({
        maxConcurrent: 1,
        queueTimeoutMs: 100,
      })

      const gate = deferred()
      const running = throttle(throttler)(
        makeContext(),
        (() => gate.promise) as any,
      )

      await flush()

      const queuedNext = vi.fn().mockResolvedValue(undefined)
      const queued = throttle(throttler)(makeContext(), queuedNext as any)

      // Attach a catcher synchronously so the unhandled rejection slot is consumed.
      const queuedResult = queued.catch((e) => e)

      await vi.advanceTimersByTimeAsync(100)

      const err = await queuedResult
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toMatch(/timeout/i)
      expect(queuedNext).not.toHaveBeenCalled()

      gate.resolve()
      await running
    })
  })

  describe('per-key isolation', () => {
    it('does not share concurrency between different keys', async () => {
      const throttler = new MemoryThrottle({ maxConcurrent: 1 })

      const gateA = deferred()
      const gateB = deferred()

      const nextA = vi.fn().mockReturnValue(gateA.promise)
      const nextB = vi.fn().mockReturnValue(gateB.promise)

      const callA = throttle(throttler, { key: () => 'a' })(
        makeContext(),
        nextA as any,
      )
      const callB = throttle(throttler, { key: () => 'b' })(
        makeContext(),
        nextB as any,
      )

      await flush()
      // Both should be running because they live under different keys.
      expect(nextA).toHaveBeenCalled()
      expect(nextB).toHaveBeenCalled()

      gateA.resolve()
      gateB.resolve()
      await Promise.all([callA, callB])
    })
  })
})
