import type { HookContext } from '@feathersjs/feathers'
import type { HookType, MethodName } from '../../types.js'
import { isContext } from '../../predicates/is-context/is-context.js'

/**
 * Restrict a hook to run for certain methods and method types.
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
