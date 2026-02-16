import type { HookContext, HookType } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'

export type SkipHookName =
  | 'all'
  | HookType
  | `${HookType}:${string}`
  | (string & {})

/**
 * Adds hook names to `context.params.skipHooks` so that `skippable`-wrapped hooks
 * will be bypassed for the current service call. Accepts a single name or an array.
 * Duplicates are automatically removed.
 *
 * @example
 * ```ts
 * import { addSkip } from 'feathers-utils/utils'
 *
 * // Inside a hook or custom code:
 * addSkip(context, 'myHook')
 * addSkip(context, ['hookA', 'hookB'])
 * ```
 *
 * @see https://utils.feathersjs.com/utils/add-skip.html
 */
export const addSkip = <H extends HookContext>(
  context: H,
  hooks: MaybeArray<SkipHookName>,
) => {
  const names = Array.isArray(hooks) ? hooks : [hooks]

  if (context.params.skipHooks === undefined) {
    context.params = {
      ...context.params,
      skipHooks: [...names],
    }
  } else {
    if (!Array.isArray(context.params.skipHooks)) {
      throw new Error('Invalid skipHooks parameter')
    }

    context.params = {
      ...context.params,
      skipHooks: [...new Set([...context.params.skipHooks, ...names])],
    }
  }
}
