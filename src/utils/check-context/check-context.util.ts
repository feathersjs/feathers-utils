import type { HookContext } from '@feathersjs/feathers'
import type { HookType, MethodName } from '../../types.js'
import { isContext } from '../../predicates/is-context/is-context.predicate.js'

/**
 * Validates that the hook context matches the expected type(s) and method(s).
 * Throws an error if the context is invalid, preventing hooks from running in
 * unsupported configurations. Typically used internally by other hooks.
 *
 * @example
 * ```ts
 * import { checkContext } from 'feathers-utils/utils'
 *
 * const myHook = (context) => {
 *   checkContext(context, ['before', 'around'], ['create', 'patch'], 'myHook')
 *   // ... hook logic
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/check-context.html
 */
export function checkContext<H extends HookContext = HookContext>(
  context: H,
  type?: HookType | HookType[] | null,
  methods?: MethodName | MethodName[] | null,
  label = 'anonymous',
): void {
  if (
    !isContext({
      method: methods ?? undefined,
      type: type ?? undefined,
    })(context)
  ) {
    throw new Error(`The '${label}' hook has invalid context.`)
  }
}
