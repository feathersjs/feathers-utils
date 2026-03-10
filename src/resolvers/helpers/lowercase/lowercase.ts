import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from '../../resolvers.internal.js'
import type { ResolverCondition } from '../../resolver-condition.js'

/**
 * Returns a resolver property that converts string values to lowercase.
 * Non-string values are passed through unchanged.
 *
 * @example
 * ```ts
 * import { resolveData, lowercase } from 'feathers-utils/resolvers'
 *
 * resolveData({
 *   email: lowercase(),
 * })
 * ```
 */
export function lowercase<H extends HookContext = HookContext>(
  condition?: ResolverCondition<H>,
) {
  return (options: ResolverPropertyOptions<any, any, H>) => {
    if (condition && !condition(options)) {
      return options.value
    }
    return typeof options.value === 'string'
      ? options.value.toLowerCase()
      : options.value
  }
}
