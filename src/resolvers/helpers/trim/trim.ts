import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from '../../resolvers.internal.js'
import type { ResolverCondition } from '../../resolver-condition.js'

/**
 * Returns a resolver property that trims whitespace from string values.
 * Non-string values are passed through unchanged.
 *
 * @example
 * ```ts
 * import { resolveData, trim } from 'feathers-utils/resolvers'
 *
 * resolveData({
 *   name: trim(),
 * })
 * ```
 */
export function trim<H extends HookContext = HookContext>(
  condition?: ResolverCondition<H>,
) {
  return (options: ResolverPropertyOptions<any, any, H>) => {
    if (condition && !condition(options)) {
      return options.value
    }
    return typeof options.value === 'string'
      ? options.value.trim()
      : options.value
  }
}
