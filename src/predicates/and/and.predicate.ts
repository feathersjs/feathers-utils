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
 * import { iff, and, isProvider, isMulti } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(and(isProvider('external'), isMulti), checkMulti())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/and.html
 */
export const and = <H extends HookContext = HookContext>(
  ...predicates: (PredicateFn<H> | undefined)[]
): PredicateFn<H> => {
  const filtered = predicates.filter(
    (p): p is PredicateFn<H> => p !== undefined,
  )

  return (context: H): boolean | Promise<boolean> => {
    // same as Array.prototype.every for empty arrays
    // see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every#description
    if (!filtered.length) {
      return true
    }

    const promises: Promise<boolean>[] = []

    for (const predicate of filtered) {
      const result = predicate(context)
      if (result === false) {
        return false
      } else if (isPromise(result)) {
        promises.push(result)
      }
    }

    if (!promises.length) {
      return true
    }

    return Promise.all(promises).then((results) =>
      results.every((result) => !!result),
    )
  }
}

// Alias for 'every'
export const every = and
