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
  function hook(context: H): H | void | Promise<H | void>
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): H | void | Promise<H | void> {
    const skip = predicate(context)

    const skipOrRun = (shouldSkip: boolean): H | void | Promise<H | void> => {
      if (shouldSkip) {
        if (next) return next()
        return
      }
      if (next) return innerHook(context, next) as Promise<void>
      // before/after mode: return the inner hook's result so an async hook is
      // awaited and a returned/modified context is propagated to the pipeline.
      return innerHook(context)
    }

    if (!skip || typeof skip === 'boolean') {
      return skipOrRun(skip)
    }

    return skip.then(skipOrRun) as Promise<void>
  }
  return hook
}
