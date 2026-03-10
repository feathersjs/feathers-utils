import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from '../../resolvers.internal.js'
import type { ResolverCondition } from '../../resolver-condition.js'

/**
 * Returns a resolver property that sets a default value when the current value
 * is `undefined` or `null`. Accepts a static value or a function that receives
 * the hook context.
 *
 * @example
 * ```ts
 * import { resolveData, defaults } from 'feathers-utils/resolvers'
 *
 * resolveData({
 *   role: defaults('user'),
 *   createdBy: defaults((context) => context.params.user?.id),
 * })
 * ```
 */
export function defaults<H extends HookContext = HookContext>(
  defaultValue: unknown | ((context: H) => unknown),
  condition?: ResolverCondition<H>,
) {
  return (options: ResolverPropertyOptions<any, any, H>) => {
    if (condition && !condition(options)) {
      return options.value
    }
    if (options.value !== undefined && options.value !== null) {
      return options.value
    }
    return typeof defaultValue === 'function'
      ? (defaultValue as (context: H) => unknown)(options.context)
      : defaultValue
  }
}
