import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { clone, traverse as _traverse } from '../../common/index.js'

export type TraverseOptions = {
  /**
   * Called for every node of the traversal, with `neotraverse`'s context as
   * `this` — so `this.key`, `this.update(value)` and `this.remove()` are what
   * the transformation is written in terms of.
   */
  transformer: (transformContext: any) => any
  /**
   * Picks what is walked out of the hook context, e.g. `context.data`,
   * `context.params.query` or `context.result`. The returned object is
   * traversed in place — `context.params.query` is deep-cloned first, so
   * walking it leaves the caller's query untouched (other `params` members are
   * walked as they are).
   */
  getObject: (
    context: HookContext,
  ) => Record<string, any> | Record<string, any>[]
  /**
   * For `around` hooks only: run the traversal *after* `next()` instead of before.
   * Required when `getObject` targets `context.result`, which is only populated
   * once the service method has run. Defaults to `false` (run before `next()`),
   * which is correct for `context.data`/`context.params.query` targets.
   *
   * @default false
   */
  runAfter?: boolean
}

/**
 * Recursively walks and transforms fields in record(s) using `neotraverse`.
 * The `getObject` function extracts the target from the context, and `transformer`
 * is called for every node during traversal --- ideal for deep, structural transformations.
 *
 * @example
 * ```ts
 * import { traverse } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   after: {
 *     all: [traverse({ getObject: (ctx) => ctx.result, transformer: function () { if (this.key === 'password') this.remove() } })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/traverse.html
 */
export const traverse = <H extends HookContext = HookContext>({
  transformer,
  getObject,
  runAfter = false,
}: TraverseOptions) => {
  const runTraverse = (context: H) => {
    if (context.params.query) {
      context.params = { ...context.params, query: clone(context.params.query) }
    }

    _traverse(getObject(context), transformer)
  }

  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    if (next && runAfter) {
      // around hook targeting context.result: transform after the method ran
      return next().then(() => {
        runTraverse(context)
      })
    }

    runTraverse(context)

    if (next) return next()

    return
  }
  return hook
}
