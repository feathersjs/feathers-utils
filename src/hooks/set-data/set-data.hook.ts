import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import _has from 'lodash/has.js'

import type { FeathersError } from '@feathersjs/errors'
import { Forbidden } from '@feathersjs/errors'

import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { type PropertyPath } from 'lodash'
import { contextToJson } from '../../utils/context-to-json/context-to-json.util.js'
import { getDataIsArray } from '../../utils/index.js'
import type { PredicateItemWithContext } from '../../types.js'

export interface HookSetDataOptions {
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
}

/**
 * hook to set properties on `context.data`
 *
 * @see https://utils.feathersjs.com/hooks/set-data.html
 */
export function setData<H extends HookContext = HookContext>(
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
  options?: HookSetDataOptions,
) {
  const { allowUndefined = false, overwrite = true } = options ?? {}

  return (context: H, next?: NextFunction) => {
    const { data } = getDataIsArray(context)

    const contextJson = contextToJson(context)

    if (!_has(contextJson, from)) {
      if (!context.params?.provider || allowUndefined === true) {
        return context
      }

      if (
        !overwrite &&
        data.every((item: Record<string, unknown>) => _has(item, to))
      ) {
        return context
      }

      throw options?.error
        ? options.error(context, from)
        : new Forbidden(`Expected field ${from.toString()} not available`)
    }

    const val = _get(contextJson, from)

    for (let i = 0, len = data.length; i < len; i++) {
      const item: Record<string, unknown> = data[i]

      const currentOverwrite =
        typeof overwrite === 'function' ? overwrite(item, context) : overwrite

      if (!currentOverwrite && _has(item, to)) {
        continue
      }

      _set(item, to, val)
    }

    if (next) {
      return next()
    }

    return context
  }
}
