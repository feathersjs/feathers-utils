import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { HookFunction, PredicateFn } from '../../types.js'

/**
 * Wraps a hook so it can be conditionally skipped based on a predicate.
 * When the predicate returns `true`, the wrapped hook is skipped entirely.
 * Commonly used with `shouldSkip` and `addSkip` for runtime hook control.
 *
 * @example
 * ```ts
 * import { skippable, shouldSkip } from 'feathers-utils/predicates'
 *
 * const myHook = skippable(someHook(), shouldSkip('someHook'))
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/skippable.html
 */
export const skippable = <H extends HookContext = HookContext>(
  innerHook: HookFunction<H>,
  predicate: PredicateFn<H>,
) => {
  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    const skip = predicate(context)

    const skipOrRun = (shouldSkip: boolean): void | Promise<void> => {
      if (shouldSkip) {
        if (next) return next()
        return
      }
      if (next) return innerHook(context, next) as Promise<void>
      innerHook(context)
    }

    if (!skip || typeof skip === 'boolean') {
      return skipOrRun(skip)
    }

    return skip.then(skipOrRun) as Promise<void>
  }
  return hook
}
