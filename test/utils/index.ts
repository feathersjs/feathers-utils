import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { copy } from 'fast-copy'
import { expect } from 'vitest'

/**
 * Helpers shared by the `*.test.ts` files. They live outside `src`, so they
 * never reach the build.
 */

export const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}

/**
 * Asserts that `fn` never writes into `input` — typically the params (and so
 * the query) a hook or util is handed, which belong to the caller, who may
 * reuse them for the next call.
 *
 * Runs `fn` twice: on a mutable copy of `input`, which has to come out
 * unchanged — that catches any write that lasts, a sloppy-mode dependency's
 * (lodash) included — and on a deep-frozen copy, where a write throws in
 * strict mode even when it would have been undone before `fn` returns. Both
 * runs have to produce the same output, which is returned for further
 * assertions.
 *
 * @example
 * ```ts
 * const params = await expectNoSideEffects({ query: { $limit: -1 } }, (params) => {
 *   const context = { type: 'before', method: 'find', params } as HookContext
 *   disablePagination()(context)
 *   return context.params
 * })
 * expect(params).toEqual({ query: {}, paginate: false })
 * ```
 */
export async function expectNoSideEffects<T, R>(
  input: T,
  fn: (input: T) => R | Promise<R>,
): Promise<R> {
  const mutable = copy(input)
  const expected = await fn(mutable)
  expect(mutable).toStrictEqual(input)

  const actual = await fn(deepFreeze(copy(input)))
  expect(actual).toEqual(expected)

  return actual
}

/**
 * An around hook that records the most service calls that ran at the same
 * time. Each call waits a macrotask first, so calls started together overlap.
 *
 * @example
 * ```ts
 * const tracker = trackConcurrency()
 * todosService.hooks({ around: { remove: [tracker.hook] } })
 * await removeMany(app, 'todos', params, { multi: false, concurrency: 2 })
 * expect(tracker.max).toBe(2)
 * ```
 */
export const trackConcurrency = () => {
  let running = 0
  const tracker = {
    max: 0,
    hook: async (_context: HookContext, next: NextFunction) => {
      running++
      tracker.max = Math.max(tracker.max, running)
      try {
        await new Promise((resolve) => setTimeout(resolve, 0))
        await next()
      } finally {
        running--
      }
    },
  }
  return tracker
}
