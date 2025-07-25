import type { HookContext } from '@feathersjs/feathers'
import { isPromise } from '../../common/index.js'
import type { PredicateFn } from '../../types.js'

/**
 * Negate a predicate function.
 *
 * @see https://utils.feathersjs.com/predicates/not.html
 */
export const not =
  <H extends HookContext = HookContext>(
    predicate: PredicateFn<H>,
  ): PredicateFn<H> =>
  (context: H) => {
    const result = predicate(context)

    if (!isPromise(result)) {
      return !result
    }

    return result.then((result1) => !result1)
  }
