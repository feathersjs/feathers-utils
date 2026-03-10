import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from '../../resolvers.internal.js'
import type { ResolverCondition } from '../../resolver-condition.js'

/**
 * Returns a resolver property that removes the field by returning `undefined`.
 * When a condition is provided, the field is only omitted if the condition returns `true`.
 *
 * @example
 * ```ts
 * import { resolveResult, omit, fromPredicate } from 'feathers-utils/resolvers'
 * import { isProvider } from 'feathers-utils/predicates'
 *
 * resolveResult({
 *   password: omit(),
 *   secret: omit(fromPredicate(isProvider('external'))),
 * })
 * ```
 */
export function omit<H extends HookContext = HookContext>(
  condition?: ResolverCondition<H>,
) {
  return (options: ResolverPropertyOptions<any, any, H>) => {
    if (condition && !condition(options)) {
      return options.value
    }
    return undefined
  }
}
