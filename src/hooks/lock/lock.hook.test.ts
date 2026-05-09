import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lock } from './lock.hook.js'
import { MemoryThrottle } from '../throttle/memory-throttle.js'

const makeContext = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'around',
    method: 'patch',
    path: 'orders',
    id: 1,
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

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

describe('hook - lock', () => {
  it('serializes tasks with the same key', async () => {
    const hook = lock({ key: (ctx: any) => `${ctx.path}:${ctx.id}` })

    const gates = [deferred(), deferred(), deferred()]
    const nexts = gates.map((g) => vi.fn().mockReturnValue(g.promise))

    const calls = nexts.map((n) => hook(makeContext(), n as any))

    await flush()
    expect(nexts[0]).toHaveBeenCalled()
    expect(nexts[1]).not.toHaveBeenCalled()
    expect(nexts[2]).not.toHaveBeenCalled()

    gates[0].resolve()
    await flush()
    expect(nexts[1]).toHaveBeenCalled()
    expect(nexts[2]).not.toHaveBeenCalled()

    gates[1].resolve()
    await flush()
    expect(nexts[2]).toHaveBeenCalled()

    gates[2].resolve()
    await Promise.all(calls)
  })

  it('runs tasks with different keys in parallel', async () => {
    const hook = lock({ key: (ctx: any) => `${ctx.path}:${ctx.id}` })

    const gateA = deferred()
    const gateB = deferred()
    const nextA = vi.fn().mockReturnValue(gateA.promise)
    const nextB = vi.fn().mockReturnValue(gateB.promise)

    const callA = hook(makeContext({ id: 1 }), nextA as any)
    const callB = hook(makeContext({ id: 2 }), nextB as any)

    await flush()
    expect(nextA).toHaveBeenCalled()
    expect(nextB).toHaveBeenCalled()

    gateA.resolve()
    gateB.resolve()
    await Promise.all([callA, callB])
  })

  it('releases the lock when the task throws', async () => {
    const hook = lock({ key: () => 'x' })

    await expect(
      hook(makeContext(), vi.fn().mockRejectedValue(new Error('boom')) as any),
    ).rejects.toThrow('boom')

    const after = vi.fn().mockResolvedValue(undefined)
    await hook(makeContext(), after as any)
    expect(after).toHaveBeenCalledOnce()
  })

  it('two standalone lock() calls do NOT share state even with the same key', async () => {
    const hookA = lock({ key: () => 'x' })
    const hookB = lock({ key: () => 'x' })

    const gateA = deferred()
    const gateB = deferred()
    const nextA = vi.fn().mockReturnValue(gateA.promise)
    const nextB = vi.fn().mockReturnValue(gateB.promise)

    const callA = hookA(makeContext(), nextA as any)
    const callB = hookB(makeContext(), nextB as any)

    await flush()
    // Each hook has its own throttler, so both run in parallel.
    expect(nextA).toHaveBeenCalled()
    expect(nextB).toHaveBeenCalled()

    gateA.resolve()
    gateB.resolve()
    await Promise.all([callA, callB])
  })

  it('a shared throttler makes two lock() registrations coordinate', async () => {
    const throttler = new MemoryThrottle({ maxConcurrent: 1 })
    const hookA = lock(throttler, { key: () => 'shared' })
    const hookB = lock(throttler, { key: () => 'shared' })

    const gateA = deferred()
    const nextA = vi.fn().mockReturnValue(gateA.promise)
    const nextB = vi.fn().mockResolvedValue(undefined)

    const callA = hookA(makeContext(), nextA as any)
    const callB = hookB(makeContext(), nextB as any)

    await flush()
    expect(nextA).toHaveBeenCalled()
    // B must wait because it resolves to the same key via the shared throttler.
    expect(nextB).not.toHaveBeenCalled()

    gateA.resolve()
    await flush()
    expect(nextB).toHaveBeenCalled()

    await Promise.all([callA, callB])
  })

  describe('timeoutMs', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('rejects waiters that exceed timeoutMs', async () => {
      const hook = lock({ key: () => 'x', timeoutMs: 100 })

      const gate = deferred()
      const running = hook(makeContext(), (() => gate.promise) as any)
      await flush()

      const waitingNext = vi.fn().mockResolvedValue(undefined)
      const waiting = hook(makeContext(), waitingNext as any).catch((e) => e)

      await vi.advanceTimersByTimeAsync(100)

      const err = await waiting
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toMatch(/timeout/i)
      expect(waitingNext).not.toHaveBeenCalled()

      gate.resolve()
      await running
    })
  })
})
