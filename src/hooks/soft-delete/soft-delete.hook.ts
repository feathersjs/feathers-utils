import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'
import type { TransformParamsFn } from '../../types.js'
import { transformParams } from '../../utils/transform-params/transform-params.util.js'
import { early, type Promisable } from '../../internal.utils.js'
import { isPromise } from 'node:util/types'

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
}

/**
 * Allow to mark items as deleted instead of removing them.
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

  return async (context: H, next?: NextFunction) => {
    checkContext(context, ['before', 'around'], null, 'softDelete')

    const { disableSoftDeleteKey = 'disableSoftDelete' } = options

    if (context.params[disableSoftDeleteKey]) {
      return early(context, next)
    }

    const { deletedQuery, removeData } = options

    let deleteQuery = getValue(deletedQuery, context)
    if (isPromise(deleteQuery)) {
      deleteQuery = await deleteQuery
    }

    const params = transformParams(
      {
        ...context.params,
        query: {
          ...context.params.query,
          ...deleteQuery,
        },
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
      return await next()
    }

    return context
  }
}

const getValue = (value: any, ...args: any[]) => {
  if (typeof value === 'function') {
    return value(...args)
  }
  return value
}
