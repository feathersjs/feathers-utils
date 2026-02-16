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
export const skippable =
  <H extends HookContext = HookContext>(
    hook: HookFunction<H>,
    predicate: PredicateFn<H>,
  ) =>
  (context: H, next?: NextFunction) => {
    const skip = predicate(context)

    function skipOrRun(skip: boolean) {
      if (skip) {
        return context
      } else {
        return hook(context, next)
      }
    }

    if (!skip || typeof skip === 'boolean') {
      return skipOrRun(skip)
    }

    return skip.then(skipOrRun)
  }
