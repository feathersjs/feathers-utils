import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext, getResultIsArray } from '../../utils/index.js'
import type { MaybeArray, NeverFallback } from '../../internal.utils.js'
import type {
  InferFindParams,
  InferGetResult,
} from '../../utility-types/infer-service-methods.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'

export type OnDeleteAction = 'cascade' | 'set null'

export interface OnDeleteOptions<
  H extends HookContext = HookContext,
  S extends keyof H['app']['services'] = keyof H['app']['services'],
> {
  /**
   * The related service where related items should be manipulated
   */
  service: S
  /**
   * The propertyKey in the related service
   */
  keyThere: NeverFallback<keyof InferGetResult<H['app']['services'][S]>, string>
  /**
   * The propertyKey in the current service.
   */
  keyHere: keyof ResultSingleHookContext<H>
  /**
   * The action to perform on the related items.
   *
   * - `cascade`: remove related items
   * - `set null`: set the related property to null
   */
  onDelete: OnDeleteAction
  /**
   * Additional query to merge into the service call.
   * Typed based on the related service's query type.
   */
  query?: InferFindParams<H['app']['services'][S]>['query']
  /**
   * If true, the hook will wait for the service to finish before continuing
   *
   * @default false
   */
  blocking?: boolean
}

/**
 * Manipulates related items when a record is deleted, similar to SQL foreign key actions.
 * Supports `'cascade'` (remove related records) and `'set null'` (nullify the foreign key).
 * Unlike database-level cascades, this hook triggers service events and hooks for related items.
 *
 * @example
 * ```ts
 * import { onDelete } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   after: {
 *     remove: [onDelete({ service: 'posts', keyHere: 'id', keyThere: 'userId', onDelete: 'cascade' })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/on-delete.html
 */
type OnDeleteOptionsDistributed<H extends HookContext> = {
  [S in keyof H['app']['services'] & string]: OnDeleteOptions<H, S>
}[keyof H['app']['services'] & string]

export const onDelete = <H extends HookContext = HookContext>(
  options: MaybeArray<OnDeleteOptionsDistributed<H>>,
) => {
  const optionsMulti = Array.isArray(options) ? options : [options]

  return async (context: H, next?: NextFunction) => {
    checkContext(context, ['after', 'around'], 'remove', 'onDelete')

    if (next) {
      await next()
    }

    const { result } = getResultIsArray(context)

    if (!result.length) {
      return
    }

    const promises: Promise<any>[] = []

    optionsMulti.forEach(
      async ({ keyHere, keyThere, onDelete, service, blocking, query }) => {
        let ids = result.map((x) => x[keyHere]).filter((x) => !!x)
        ids = [...new Set(ids)]

        if (!ids || ids.length <= 0) {
          return context
        }

        const params = {
          query: {
            ...query,
            ...(ids.length === 1
              ? { [keyThere]: ids[0] }
              : { [keyThere]: { $in: ids } }),
          },
          paginate: false,
        }

        let promise: Promise<any> | undefined = undefined

        if (onDelete === 'cascade') {
          promise = context.app.service(service as string).remove(null, params)
        } else if (onDelete === 'set null') {
          const data = { [keyThere]: null }
          promise = context.app
            .service(service as string)
            .patch(null, data, params)
        }

        if (promise && blocking) {
          promises.push(promise)
        }
      },
    )

    if (promises.length) {
      await Promise.all(promises)
    }

    return
  }
}
