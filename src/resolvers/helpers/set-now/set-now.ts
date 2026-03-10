import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from '../../resolvers.internal.js'
import type { ResolverCondition } from '../../resolver-condition.js'

/**
 * Returns a resolver property that sets the field to the current timestamp
 * (`Date.now()`). Always overwrites the existing value.
 *
 * @example
 * ```ts
 * import { resolveData, setNow } from 'feathers-utils/resolvers'
 *
 * resolveData({
 *   createdAt: setNow(),
 * })
 * ```
 */
export function setNow<H extends HookContext = HookContext>(
  condition?: ResolverCondition<H>,
) {
  return (options: ResolverPropertyOptions<any, any, H>) => {
    if (condition && !condition(options)) {
      return options.value
    }
    return Date.now()
  }
}
