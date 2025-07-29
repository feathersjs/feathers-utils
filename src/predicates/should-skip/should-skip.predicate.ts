import { GeneralError } from '@feathersjs/errors'

import type { HookContext } from '@feathersjs/feathers'
import type { SkipHookName } from '../../utils/index.js'

/**
 * Util to detect if a hook should be skipped
 *
 * Checks the `params.skipHooks` array for the hook name, type, or 'all'.
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
