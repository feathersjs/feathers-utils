import type { HookContext, NextFunction } from '@feathersjs/feathers'
import {
  checkContext,
  eqOrIn,
  getResultIsArray,
  patchMany,
  removeMany,
} from '../../utils/index.js'
import { resolveBoolean } from '../../common/index.js'
import type { MaybeArray, NeverFallback } from '../../internal.utils.js'
import type { Multi, PredicateFn } from '../../types.js'
import type {
  InferFindParams,
  InferGetResult,
} from '../../utility-types/infer-service-methods.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'

export type OnDeleteAction = 'cascade' | 'set null'

export interface OnDeleteOptions<
  H extends HookContext = HookContext,
  S extends keyof H['app']['services'] = keyof H['app']['services'],
  Service = H['app']['services'][S],
> {
  /**
   * The related service where related items should be manipulated
   */
  service: S
  /**
   * The propertyKey in the related service
   */
  keyThere: NeverFallback<keyof InferGetResult<Service>, string>
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
  query?: InferFindParams<Service>['query']
  /**
   * Returns the params of the `patch`/`remove` calls in the related service -
   * e.g. to change the related items in the call's transaction. Their `query`
   * is merged with `query` and the relation, which win.
   *
   * A transaction only holds them while `blocking`: in the background, they
   * may be changed after it ended.
   *
   * @example (context) => ({ transaction: context.params.transaction })
   */
  params?: (context: H) => InferFindParams<Service>
  /**
   * Whether the related service allows manipulating multiple items in a single
   * `patch`/`remove` call.
   *
   * Defaults to the `multi` option of the related service. If multi is not
   * allowed, the related items are fetched and manipulated with one
   * `patch`/`remove` call per item.
   *
   * @default service.options.multi
   */
  multi?: Multi
  /**
   * Whether the hook waits for the related-service call to finish before the
   * call continues. Can be a boolean or a predicate that receives the
   * `HookContext`.
   *
   * @example isProvider('external')
   * @default false
   */
  blocking?: boolean | PredicateFn<H>
  /**
   * Called when a related-service call rejects while not blocking.
   * Without this, fire-and-forget rejections are swallowed (but never leak as an
   * unhandled rejection). In `blocking` mode the error is thrown to the caller instead.
   */
  onError?: (error: any, context: H) => void
}

type OnDeleteOptionsDistributed<H extends HookContext> = {
  [S in keyof H['app']['services'] & string]: OnDeleteOptions<H, S>
}[keyof H['app']['services'] & string]

/**
 * Manipulates related items when a record is deleted, similar to SQL foreign key actions.
 * Supports `'cascade'` (remove related records) and `'set null'` (nullify the foreign key).
 * Unlike database-level cascades, this hook triggers service events and hooks for related items.
 *
 * @example
 * ```ts
 * import { onDelete } from 'feathers-utils/hooks'
 *
 * // remove the user's posts
 * app.service('users').hooks({
 *   after: {
 *     remove: [onDelete({ service: 'posts', keyHere: 'id', keyThere: 'userId', onDelete: 'cascade' })]
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * import { onDelete } from 'feathers-utils/hooks'
 *
 * // set `posts.userId` to `null` and wait for it before returning
 * app.service('users').hooks({
 *   after: {
 *     remove: [
 *       onDelete({
 *         service: 'posts',
 *         keyHere: 'id',
 *         keyThere: 'userId',
 *         onDelete: 'set null',
 *         blocking: true,
 *       }),
 *     ]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/on-delete.html
 */
export const onDelete = <H extends HookContext = HookContext>(
  options: MaybeArray<OnDeleteOptionsDistributed<H>>,
) => {
  const optionsMulti = Array.isArray(options) ? options : [options]

  return async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, {
      type: ['after', 'around'],
      method: 'remove',
      label: 'onDelete',
    })

    if (next) {
      await next()
    }

    const { result } = getResultIsArray(context)

    if (!result.length) {
      return
    }

    // resolved before any related-service call starts: awaiting a predicate
    // between the calls could leave an already started blocking call without
    // a handler when it rejects
    const isBlocking = await Promise.all(
      optionsMulti.map(({ blocking }) =>
        resolveBoolean(blocking, context, false),
      ),
    )

    const blockingPromises: Promise<any>[] = []

    for (const [
      i,
      { keyHere, keyThere, onDelete, service, query, multi, onError, params },
    ] of optionsMulti.entries()) {
      // 0 is a valid id (the memory adapter starts there), but an empty string is
      // an unset key: cascading on it would hit every related item without one
      const ids = result
        .map((x) => x[keyHere])
        .filter((x) => x != null && x !== '')

      if (ids.length <= 0) {
        continue
      }

      const baseParams = params?.(context)
      const relatedParams = {
        ...baseParams,
        query: {
          ...baseParams?.query,
          ...query,
          [keyThere]: eqOrIn(ids),
        },
        paginate: false,
      }

      let promise: Promise<any> | undefined = undefined

      if (onDelete === 'cascade') {
        promise = removeMany(context.app, service as string, relatedParams, {
          multi,
        })
      } else if (onDelete === 'set null') {
        const data = { [keyThere]: null }
        promise = patchMany(
          context.app,
          service as string,
          data,
          relatedParams,
          { multi },
        )
      }

      if (!promise) {
        continue
      }

      if (isBlocking[i]) {
        blockingPromises.push(promise)
      } else {
        // fire-and-forget: always attach a catch so a rejection never becomes
        // an unhandled promise rejection. Surface it via `onError` if provided.
        promise.catch((error) => onError?.(error, context))
      }
    }

    if (blockingPromises.length) {
      await Promise.all(blockingPromises)
    }

    return
  }
}
