import { Timeout, TooManyRequests } from '@feathersjs/errors'
import type { ThrottleAbstract } from './throttle.types.js'

export type MemoryThrottleOptions = {
  /**
   * Max in-flight tasks per key (semaphore). Defaults to `Infinity`.
   */
  maxConcurrent?: number
  /**
   * Max number of waiters that may be queued per key. When a new task arrives
   * and the queue is already at this size, `schedule` throws `TooManyRequests`
   * instead of queueing it. Defaults to `Infinity`.
   */
  maxQueueSize?: number
  /**
   * Token-bucket: number of tokens available per `reservoirIntervalMs`. One
   * token is consumed per scheduled task. Defaults to `Infinity` (disabled).
   */
  reservoir?: number
  /**
   * Window in milliseconds at which the reservoir is refilled to its full
   * value. Required if `reservoir` is set.
   */
  reservoirIntervalMs?: number
  /**
   * Max time in milliseconds a task may wait in the queue before being
   * rejected with a `Timeout` error. Defaults to `Infinity`.
   */
  queueTimeoutMs?: number
}

type Waiter = {
  fn: () => Promise<unknown>
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  timeoutTimer: ReturnType<typeof setTimeout> | null
}

type KeyState = {
  inFlight: number
  queue: Waiter[]
  tokens: number
  lastRefillAt: number
  refillTimer: ReturnType<typeof setTimeout> | null
}

/**
 * In-memory implementation of {@link ThrottleAbstract}. Coordinates within a
 * single Node process. For multi-instance deployments, implement
 * {@link ThrottleAbstract} against Redis (or wrap a library such as
 * Bottleneck) instead.
 */
export class MemoryThrottle implements ThrottleAbstract {
  readonly maxConcurrent: number
  readonly maxQueueSize: number
  readonly reservoir: number
  readonly reservoirIntervalMs: number
  readonly queueTimeoutMs: number

  private readonly states = new Map<string, KeyState>()

  constructor(options: MemoryThrottleOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? Infinity
    this.maxQueueSize = options.maxQueueSize ?? Infinity
    this.reservoir = options.reservoir ?? Infinity
    this.queueTimeoutMs = options.queueTimeoutMs ?? Infinity

    if (Number.isFinite(this.reservoir)) {
      if (
        options.reservoirIntervalMs == null ||
        options.reservoirIntervalMs <= 0
      ) {
        throw new Error(
          'MemoryThrottle: `reservoirIntervalMs` is required (and must be > 0) when `reservoir` is set.',
        )
      }
      this.reservoirIntervalMs = options.reservoirIntervalMs
    } else {
      this.reservoirIntervalMs = Infinity
    }
  }

  schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getState(key)
    this.refill(state)

    return new Promise<T>((resolve, reject) => {
      const waiter: Waiter = {
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutTimer: null,
      }

      if (this.canRun(state) && state.queue.length === 0) {
        this.runWaiter(state, waiter)
        return
      }

      if (state.queue.length >= this.maxQueueSize) {
        reject(new TooManyRequests('Throttle queue is full'))
        return
      }

      if (Number.isFinite(this.queueTimeoutMs)) {
        waiter.timeoutTimer = setTimeout(() => {
          const idx = state.queue.indexOf(waiter)
          if (idx !== -1) {
            state.queue.splice(idx, 1)
            waiter.reject(new Timeout('Throttle queue timeout'))
          }
        }, this.queueTimeoutMs)
        waiter.timeoutTimer.unref?.()
      }

      state.queue.push(waiter)
      this.scheduleRefill(state)
    })
  }

  private getState(key: string): KeyState {
    let state = this.states.get(key)
    if (!state) {
      state = {
        inFlight: 0,
        queue: [],
        tokens: this.reservoir,
        lastRefillAt: Date.now(),
        refillTimer: null,
      }
      this.states.set(key, state)
    }
    return state
  }

  private canRun(state: KeyState): boolean {
    return state.inFlight < this.maxConcurrent && state.tokens >= 1
  }

  private runWaiter(state: KeyState, waiter: Waiter): void {
    if (waiter.timeoutTimer) {
      clearTimeout(waiter.timeoutTimer)
      waiter.timeoutTimer = null
    }
    state.inFlight++
    if (Number.isFinite(this.reservoir)) {
      state.tokens -= 1
    }

    // Run the task asynchronously and release the slot when it settles,
    // regardless of whether it resolved or rejected.
    Promise.resolve()
      .then(waiter.fn)
      .then(
        (value) => {
          waiter.resolve(value)
          this.release(state)
        },
        (error) => {
          waiter.reject(error)
          this.release(state)
        },
      )
  }

  private release(state: KeyState): void {
    state.inFlight--
    this.drain(state)
  }

  private drain(state: KeyState): void {
    this.refill(state)
    while (state.queue.length > 0 && this.canRun(state)) {
      const waiter = state.queue.shift()!
      this.runWaiter(state, waiter)
    }
    if (state.queue.length > 0) {
      this.scheduleRefill(state)
    }
  }

  private refill(state: KeyState): void {
    if (!Number.isFinite(this.reservoir)) return
    const now = Date.now()
    const elapsed = now - state.lastRefillAt
    if (elapsed >= this.reservoirIntervalMs) {
      state.tokens = this.reservoir
      state.lastRefillAt = now
    }
  }

  private scheduleRefill(state: KeyState): void {
    if (!Number.isFinite(this.reservoir)) return
    if (state.refillTimer != null) return
    if (state.tokens >= 1) return
    const elapsed = Date.now() - state.lastRefillAt
    const remaining = this.reservoirIntervalMs - elapsed
    state.refillTimer = setTimeout(
      () => {
        state.refillTimer = null
        this.drain(state)
      },
      Math.max(0, remaining),
    )
    state.refillTimer.unref?.()
  }
}
