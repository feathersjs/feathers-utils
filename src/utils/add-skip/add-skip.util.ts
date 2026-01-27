import type { HookContext, HookType } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'

export type SkipHookName =
  | 'all'
  | HookType
  | `${HookType}:${string}`
  | (string & {})

/**
 * Add names to `context.params.skipHooks` for `skippable` hooks.
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
