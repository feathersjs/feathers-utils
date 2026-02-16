import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'
import { isPromise } from '../../common/index.js'

/**
 * Returns a predicate that is `true` only when **all** given predicates are `true` (logical AND).
 * Supports both sync and async predicates. Short-circuits on the first `false` result.
 * Undefined predicates in the list are skipped.
 *
 * @example
 * ```ts
 * import { iff, every, isProvider, isMulti } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(every(isProvider('external'), isMulti), checkMulti())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/every.html
 */
export const every =
  <H extends HookContext = HookContext>(
    ...predicates: (PredicateFn<H> | undefined)[]
  ): PredicateFn<H> =>
  (context: H): boolean | Promise<boolean> => {
    if (!predicates.length) {
      // same as Array.prototype.every
      // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every#description
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
      if (result === false) {
        return false
      } else if (isPromise(result)) {
        promises.push(result)
      }
    }

    if (everyUndefined) {
      // all predicates are undefined -> same as Array.prototype.every
      // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every#description
      return true
    }

    if (!promises.length) {
      // no promises returned -> all predicates are sync and true
      return true
    }

    return Promise.all(promises).then((results) =>
      results.every((result) => !!result),
    )
  }
