import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { addToQuery, checkContext, queryDefaults } from '../../utils/index.js'
import type { TransformParamsFn } from '../../types.js'
import { transformParams } from '../../utils/transform-params/transform-params.util.js'
import { early } from '../../common/index.js'
import type { Promisable } from '../../internal.utils.js'
import { isPromise } from '../../common/index.js'

export type SoftDeleteOptionFunction<H extends HookContext = HookContext> = (
  context?: H,
) => Promisable<{ [key: string]: any }>

export interface SoftDeleteOptions<H extends HookContext = HookContext> {
  /**
   * @example { deletedAt: null }
   */
  deletedQuery: { [key: string]: any } | SoftDeleteOptionFunction<H>
  /**
   * @example { deletedAt: new Date() }
   */
  removeData: { [key: string]: any } | SoftDeleteOptionFunction<H>
  /**
   * Transform the params before calling the service method. E.g. remove 'params.provider' or add custom params.
   */
  transformParams?: TransformParamsFn

  /**
   * Key in `params` to disable the soft delete functionality.
   *
   * @default 'disableSoftDelete'
   */
  disableSoftDeleteKey?: string

  /**
   * `softDelete` uses `._patch()` internally to mark items as deleted.
   *
   * If you set this option to `true`, it will use the `.patch()` method with hooks instead.
   */
  usePatchWithHooks?: boolean

  /**
   * By default, if the incoming `params.query` already references a key of
   * `deletedQuery` (e.g. `deletedAt`) — including nested inside `$and`/`$or`/`$nor` —
   * the `deletedQuery` filter is NOT added, letting the caller read soft-deleted
   * items while `remove` still soft-deletes them.
   *
   * Set this to `false` to always enforce the `deletedQuery` filter.
   *
   * @default true
   */
  allowQueryOverride?: boolean
}

/**
 * Marks items as deleted instead of physically removing them. On `remove`, the hook
 * patches the record with `removeData` (e.g. `{ deletedAt: new Date() }`). On all other
 * methods, it appends `deletedQuery` (e.g. `{ deletedAt: null }`) to filter out soft-deleted items.
 *
 * @example
 * ```ts
 * import { softDelete } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   around: {
 *     all: [softDelete({ deletedQuery: { deletedAt: null }, removeData: { deletedAt: new Date() } })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/soft-delete.html
 */
export const softDelete = <H extends HookContext = HookContext>(
  options: SoftDeleteOptions<H>,
) => {
  if (!options?.deletedQuery || !options?.removeData) {
    throw new Error(
      'You must provide `deletedQuery` and `removeData` options to the softDelete hook.',
    )
  }

  return async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, { type: ['before', 'around'], label: 'softDelete' })

    const { disableSoftDeleteKey = 'disableSoftDelete' } = options

    if (context.params[disableSoftDeleteKey]) {
      await early(context, next)
      return
    }

    const { deletedQuery, removeData, allowQueryOverride = true } = options

    let deleteQuery = getValue(deletedQuery, context)
    if (isPromise(deleteQuery)) {
      deleteQuery = await deleteQuery
    }

    const query = allowQueryOverride
      ? queryDefaults(context.params.query, deleteQuery)
      : addToQuery(context.params.query, deleteQuery)

    const params = transformParams(
      {
        ...context.params,
        query,
      },
      options.transformParams,
    )

    context.params = params

    if (context.method === 'remove') {
      let data = getValue(removeData, context)
      if (isPromise(data)) {
        data = await data
      }
      const method = options.usePatchWithHooks ? 'patch' : '_patch'
      const result = await context.service[method](context.id, data, params)

      context.result = result
    }

    if (next) {
      await next()
    }
  }
}

const getValue = (value: any, ...args: any[]) => {
  if (typeof value === 'function') {
    return value(...args)
  }
  return value
}
