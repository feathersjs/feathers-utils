import type { HookContext, Id, NextFunction } from '@feathersjs/feathers'
import { shouldSkip } from '../../predicates/should-skip/should-skip.predicate.js'
import { stashBefore, stashAfter } from '../../utils/stash/stash.util.js'
import type { Change, StashOptions } from '../../utils/stash/stash.util.js'

/**
 * Stashes the affected records of a `create`, `update`, `patch` or `remove`
 * call by their id and (optionally) passes them to a callback.
 *
 * Runs in `before` + `after` (or a single `around`) and stores the result at
 * `context.params[name]` (default `stash`) as a `Record<Id, { before, item }>`.
 * For every affected id it provides the state `before` the mutation (when
 * `fetchBefore` is enabled) and the resulting `item` after it.
 *
 * Built on top of the {@link stash} util — use that directly if you need to
 * stash imperatively inside your own hooks.
 *
 * @example
 * ```ts
 * import { stashable } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   around: {
 *     all: [
 *       stashable((stash, context) => {
 *         for (const id in stash) {
 *           const { before, item } = stash[id]
 *           // react to the change
 *         }
 *       }, { fetchBefore: true }),
 *     ],
 *   },
 * })
 *
 * // or just read it later:
 * const stash = context.params.stash
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/stashable.html
 */
export const stashable = <H extends HookContext = HookContext, T = any>(
  cb?: (stash: Record<Id, Change<T>>, context: H) => void | Promise<void>,
  options?: Partial<StashOptions<H>>,
) => {
  function hook(context: H): Promise<H>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<H | void> {
    if (shouldSkip('checkMulti')(context)) {
      return context
    }

    if (context.type === 'before' || context.type === 'around') {
      await stashBefore(context, options)
    }

    if (next) {
      await next()
    }

    if (context.type === 'after' || context.type === 'around') {
      const stash = await stashAfter<H, T>(context, options)
      if (stash && cb) {
        await cb(stash as Record<Id, Change<T>>, context)
      }
    }

    return context
  }
  return hook
}
