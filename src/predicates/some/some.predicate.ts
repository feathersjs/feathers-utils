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
 * import { iff, some, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(some(isProvider('rest'), isProvider('socketio')), rateLimitHook())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/some.html
 */
export const some =
  <H extends HookContext = HookContext>(
    ...predicates: (PredicateFn<H> | undefined)[]
  ): PredicateFn<H> =>
  (context: H): boolean | Promise<boolean> => {
    if (!predicates.length) {
      // same as Array.prototype.some
      // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some#description
      return true
    }

    const promises: Promise<boolean>[] = []

    let everyUndefined = true

    for (const predicate of predicates) {
      if (!predicate) {
        // skip undefined predicates
        continue
      } else {
        everyUndefined = false
      }

      const result = predicate(context)

      if (result === true) {
        return true
      } else if (result === false) {
        continue
      } else if (isPromise(result)) {
        promises.push(result)
      }
    }

    if (everyUndefined) {
      // all predicates are undefined -> same as Array.prototype.some
      // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some#description
      return true
    }

    if (!promises.length) {
      // no promises returned -> all predicates are sync and false
      return false
    }

    return Promise.all(promises).then((results) =>
      results.some((result) => !!result),
    )
  }
