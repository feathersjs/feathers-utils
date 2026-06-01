import _get from 'lodash/get.js'
import _setWith from 'lodash/setWith.js'
import _clone from 'lodash/clone.js'
import { checkContext } from '../../utils/index.js'
import type { FeathersError } from '@feathersjs/errors'
import { Forbidden } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'

export interface SetFieldOptions<H extends HookContext = HookContext> {
  /**
   * The target path(s) to set. Pass an array to write the same value to several
   * paths (e.g. multiple query keys).
   *
   * @example 'params.query.userId'
   * @example ['params.query.userId', 'params.query.ownerId']
   */
  as: string | string[]
  /**
   * The source of the value: a `dot.notation` path on the context, or a function
   * that derives the value from the context.
   *
   * @example 'params.user.id'
   * @example (context) => context.params.user?.id
   */
  from: string | ((context: H) => unknown)
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
  error?: (
    context: H,
    from: string | ((context: H) => unknown),
  ) => FeathersError
}

/**
 * Sets a field on the hook context (e.g. `params.query`) based on the value of another
 * context field (e.g. `params.user.id`). Useful for scoping queries to the authenticated user.
 * Throws a `Forbidden` error if the source field is missing (unless `allowUndefined` is `true`).
 *
 * @example
 * ```ts
 * import { setField } from 'feathers-utils/hooks'
 *
 * app.service('posts').hooks({
 *   before: { all: [setField({ from: 'params.user.id', as: 'params.query.userId' })] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/set-field.html
 */
export const setField = <H extends HookContext = HookContext>({
  as,
  from,
  allowUndefined = false,
  error,
}: SetFieldOptions<H>) => {
  const targets = Array.isArray(as) ? as : [as]

  function hook(context: H): void
  function hook(context: H, next: NextFunction): Promise<void>
  function hook(context: H, next?: NextFunction): void | Promise<void> {
    const { params } = context

    checkContext(context, { type: ['before', 'around'], label: 'setField' })

    const value =
      typeof from === 'function' ? from(context) : _get(context, from)

    if (value === undefined) {
      if (!params.provider || allowUndefined) {
        if (next) return next()
        return
      }

      throw error
        ? error(context, from)
        : new Forbidden(`Expected field ${targets.join(', ')} not available`)
    }

    for (const target of targets) {
      _setWith(context, target, value, _clone)
    }

    if (next) return next()

    return
  }
  return hook
}
