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
    // same as Array.prototype.some for empty arrays
    // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some#description
    if (!filtered.length) {
      return true
    }

    const promises: Promise<boolean>[] = []

    for (const predicate of filtered) {
      const result = predicate(context)

      if (result === true) {
        return true
      } else if (result === false) {
        continue
      } else if (isPromise(result)) {
        promises.push(result)
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
