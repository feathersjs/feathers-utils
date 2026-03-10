import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'
import type { ResolverCondition } from '../resolver-condition.js'

/**
 * Adapts an existing predicate function (like `isProvider`, `isContext`) into a
 * resolver condition. The predicate receives the hook context extracted from the
 * resolver options. Only synchronous predicates are supported.
 *
 * @example
 * ```ts
 * import { resolveResult, omit, fromPredicate } from 'feathers-utils/resolvers'
 * import { isProvider } from 'feathers-utils/predicates'
 *
 * resolveResult({
 *   password: omit(fromPredicate(isProvider('external'))),
 * })
 * ```
 */
export function fromPredicate<H extends HookContext = HookContext>(
  predicate: PredicateFn<H>,
): ResolverCondition<H> {
  return ({ context }) => {
    const result = predicate(context)
    if (typeof result !== 'boolean') {
      throw new Error('fromPredicate does not support async predicates')
    }
    return result
  }
}
