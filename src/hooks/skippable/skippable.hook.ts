import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { HookFunction, PredicateFn } from '../../types.js'

/**
 * Wrap a hook to make it skippable
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
