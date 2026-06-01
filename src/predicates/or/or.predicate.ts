import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'
import { isPromise } from '../../common/index.js'

/**
 * Returns a predicate that is `true` when **any** of the given predicates is `true` (logical OR).
 * Supports both sync and async predicates. Short-circuits on the first `true` result.
 * Undefined predicates in the list are skipped.
 *
 * @example
 * ```ts
 * import { iff, or, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(or(isProvider('rest'), isProvider('socketio')), rateLimitHook())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/or.html
 */
export const or = <H extends HookContext = HookContext>(
  ...predicates: (PredicateFn<H> | undefined)[]
): PredicateFn<H> => {
  const filtered = predicates.filter(
    (p): p is PredicateFn<H> => p !== undefined,
  )

  return (context: H): boolean | Promise<boolean> => {
    // The identity element of logical OR is `false` (an empty OR is false).
    if (!filtered.length) {
      return false
    }

    const promises: Promise<boolean>[] = []

    for (const predicate of filtered) {
      const result = predicate(context)

      if (isPromise(result)) {
        promises.push(result)
      } else if (result) {
        // any truthy sync result short-circuits to true
        return true
      }
    }

    if (!promises.length) {
      return false
    }

    return Promise.all(promises).then((results) =>
      results.some((result) => !!result),
    )
  }
}

// Alias for 'some'
export const some = or
