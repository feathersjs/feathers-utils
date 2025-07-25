import _get from 'lodash/get.js'
import _setWith from 'lodash/setWith.js'
import _clone from 'lodash/clone.js'
import { checkContext } from '../../utils/index.js'
import type { FeathersError } from '@feathersjs/errors'
import { Forbidden } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'

export interface SetFieldOptions {
  as: string
  from: string
  /**
   * If set to `true`, allows the field to be undefined.
   * If the field is not available and this is `true`, the hook will not throw an error.
   *
   * If set to `false`, the hook will throw an error if the field is not available.
   *
   * @default false
   */
  allowUndefined?: boolean
  /**
   * Customize the error that is thrown if the field is not available.
   *
   * If not provided, throws a `Forbidden` error with a message indicating the missing field.
   */
  error?: (context: HookContext, from: string) => FeathersError
}

/**
 * The `setField` hook allows to set a field on the hook context based on the value of another field on the hook context.
 *
 * @see https://utils.feathersjs.com/hooks/set-field.html
 */
export const setField =
  <H extends HookContext = HookContext>({
    as,
    from,
    allowUndefined = false,
    error,
  }: SetFieldOptions) =>
  (context: H, next?: NextFunction) => {
    const { params } = context

    checkContext(context, ['before', 'around'], null, 'setField')

    const value = _get(context, from)

    if (value === undefined) {
      if (!params.provider || allowUndefined) {
        return context
      }

      throw error
        ? error(context, from)
        : new Forbidden(`Expected field ${as} not available`)
    }

    context = _setWith(context, as, value, _clone)

    if (next) return next()

    return context
  }
