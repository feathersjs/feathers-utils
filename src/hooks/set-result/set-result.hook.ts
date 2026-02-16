import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import _has from 'lodash/has.js'

import type { FeathersError } from '@feathersjs/errors'
import { Forbidden } from '@feathersjs/errors'

import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { PropertyPath } from 'lodash'
import { contextToJson } from '../../utils/context-to-json/context-to-json.util.js'
import { getResultIsArray } from '../../utils/index.js'
import type { DispatchOption, PredicateItemWithContext } from '../../types.js'

export interface SetResultOptions {
  /**
   * Wether to throw if the context[from] is undefined.
   *
   * @default false
   */
  allowUndefined?: boolean
  /**
   * @default true
   */
  overwrite?: boolean | PredicateItemWithContext
  /**
   * Customize the error that is thrown if the context[from] is not available.
   * If not provided, throws a `Forbidden` error with a message indicating the missing field.
   */
  error?: (context: HookContext, from: PropertyPath) => FeathersError
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

    if (!_has(contextJson, from)) {
      if (!context.params?.provider || allowUndefined === true) {
        return context
      }

      if (
        !overwrite &&
        result.every((item: Record<string, unknown>) => _has(item, to))
      ) {
        return context
      }

      throw options?.error
        ? options.error(context, from)
        : new Forbidden(`Expected field ${from.toString()} not available`)
    }

    const val = _get(contextJson, from)

    for (let i = 0; i < result.length; i++) {
      const item: Record<string, unknown> = result[i]

      const currentOverwrite =
        typeof overwrite === 'function' ? overwrite(item, context) : overwrite

      if (!currentOverwrite && _has(item, to)) {
        continue
      }

      _set(item, to, val)
    }

    return context
  }

  const fn = (context: H) => {
    if (options?.dispatch === 'both') {
      forResultOrDispatch(context, true)
      return forResultOrDispatch(context, false)
    }

    return forResultOrDispatch(context, !!options?.dispatch)
  }

  return (context: H, next?: NextFunction) => {
    if (next) {
      next().then(() => fn(context))
    }

    return fn(context)
  }
}
