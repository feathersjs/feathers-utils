import { copy } from 'fast-copy'

import type { FeathersError } from '@feathersjs/errors'
import { Forbidden } from '@feathersjs/errors'

import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type {
  PropertyPath,
  DispatchOption,
  PredicateItemWithContext,
} from '../../types.js'
import { contextToJson } from '../../utils/context-to-json/context-to-json.util.js'
import { getResultIsArray } from '../../utils/index.js'
import { getPath, hasPath, setPathInPlace } from '../../common/index.js'

export interface SetResultOptions {
  /**
   * Whether a missing `from` on the context is allowed. With `false`, an
   * external call (one with a `params.provider`) that misses it is rejected —
   * an internal call never is.
   *
   * @default false
   */
  allowUndefined?: boolean
  /**
   * Whether a value already present at `to` is overwritten.
   *
   * Pass a `(item, context) => boolean` predicate to decide per item — items it
   * returns `false` for keep the value they came in with.
   *
   * @default true
   */
  overwrite?: boolean | PredicateItemWithContext
  /**
   * Customize the error that is thrown if the context[from] is not available.
   * If not provided, throws a `Forbidden` error with a message indicating the missing field.
   */
  error?: (context: HookContext, from: PropertyPath) => FeathersError
  /**
   * Which of `context.result` and `context.dispatch` the property is set on.
   * `true` targets `dispatch` (seeded from `result` when it is still empty),
   * `'both'` targets each of them.
   *
   * @default false
   */
  dispatch?: DispatchOption
}

/**
 * Sets a property on each item in `context.result` from another property on the hook context.
 * Supports dot-notation paths for both source and target, and can optionally
 * operate on `context.dispatch` as well.
 *
 * @example
 * ```ts
 * import { setResult } from 'feathers-utils/hooks'
 *
 * app.service('posts').hooks({
 *   after: { all: [setResult('params.user.id', 'currentUserId')] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/set-result.html
 */
export function setResult<H extends HookContext = HookContext>(
  /**
   * The property path of the context to set the value from. 'dot.notation' is supported.
   *
   * If the property does not exist, the hook will throw an error unless `allowUndefined` is set to true.
   * If the property exists, it will be set to the value of the `to` property path of the data item.
   *
   * @example 'params.user.id'
   */
  from: PropertyPath,
  /**
   * The property path of the data item to set the value to. 'dot.notation' is supported.
   *
   * If the property does not exist, it will be created.
   * If the property exists, it will be overwritten unless `overwrite` is set to false.
   *
   * @example 'userId'
   */
  to: PropertyPath,
  options?: SetResultOptions,
) {
  const { allowUndefined = false, overwrite = true } = options ?? {}

  const forResultOrDispatch = (context: H, dispatch: boolean) => {
    const { result } = getResultIsArray(context, { dispatch })

    const contextJson = contextToJson(context)

    if (!hasPath(contextJson, from)) {
      if (!context.params?.provider || allowUndefined === true) {
        return context
      }

      if (
        !overwrite &&
        result.every((item: Record<string, unknown>) => hasPath(item, to))
      ) {
        return context
      }

      throw options?.error
        ? options.error(context, from)
        : new Forbidden(`Expected field ${from.toString()} not available`)
    }

    const val = getPath(contextJson, from)

    for (let i = 0; i < result.length; i++) {
      const item: Record<string, unknown> = result[i]

      const currentOverwrite =
        typeof overwrite === 'function' ? overwrite(item, context) : overwrite

      if (!currentOverwrite && hasPath(item, to)) {
        continue
      }

      setPathInPlace(item, to, val)
    }

    return context
  }

  const fn = (context: H) => {
    // Seed context.dispatch from result so the dispatch branch mutates (and
    // persists to) a real object instead of a throwaway copy. Mirrors mutateResult.
    if (!!options?.dispatch && !context.dispatch) {
      context.dispatch = copy(context.result)
    }

    if (options?.dispatch === 'both') {
      forResultOrDispatch(context, true)
      return forResultOrDispatch(context, false)
    }

    return forResultOrDispatch(context, !!options?.dispatch)
  }

  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    if (next) {
      return next().then(() => {
        fn(context)
      })
    }

    fn(context)
    return
  }
  return hook
}
