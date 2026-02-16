import { GeneralError } from '@feathersjs/errors'

import type { HookContext } from '@feathersjs/feathers'
import type { SkipHookName } from '../../utils/index.js'

/**
 * Returns a predicate that checks `params.skipHooks` to determine if a hook should be skipped.
 * Matches by hook name, hook type (e.g. `'before'`), prefixed name (e.g. `'before:myHook'`),
 * or `'all'` to skip everything. Designed to be used with `skippable` and `addSkip`.
 *
 * @example
 * ```ts
 * import { skippable, shouldSkip } from 'feathers-utils/predicates'
 *
 * const myHook = skippable(actualHook(), shouldSkip('myHook'))
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/should-skip.html
 */
export const shouldSkip = <H extends HookContext = HookContext>(
  hookName: SkipHookName,
) => {
  return (context: H): boolean => {
    if (!context.params?.skipHooks) {
      return false
    }

    const { skipHooks } = context.params
    if (!Array.isArray(skipHooks)) {
      throw new GeneralError(
        'The `skipHooks` param must be an Array of Strings',
      )
    }
    const { type } = context
    if (skipHooks.includes(hookName)) {
      return true
    } else if (skipHooks.includes('all')) {
      return true
    } else if (skipHooks.includes(type)) {
      return true
    } else if (skipHooks.includes(`${type}:${hookName}`)) {
      return true
    }

    return false
  }
}
