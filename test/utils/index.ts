import type { HookContext, NextFunction } from '@feathersjs/feathers'

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
