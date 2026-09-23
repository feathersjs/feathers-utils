import type { HookContext, NextFunction } from '@feathersjs/feathers'
import {
  checkContext,
  createMany,
  getResultIsArray,
} from '../../utils/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { Multi, PredicateFn } from '../../types.js'
import type { InferCreateDataSingle } from '../../utility-types/infer-service-methods.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'

export interface CreateRelatedOptions<
  H extends HookContext = HookContext,
  Services extends H['app']['services'] = H['app']['services'],
  S extends keyof Services = keyof Services,
> {
  /**
   * The service the related records are created in — a key of `app.services`.
   */
  service: S
  /**
   * Is relevant when the current context result is an array.
   *
   * Whether the related service allows creating multiple items in a single
   * call. Defaults to the `multi` option of the related service. If multi
   * creating is not allowed, the related records are created with one call
   * per item.
   *
   * @default service.options.multi
   */
  multi?: Multi
  /**
   * A function that returns the data to be created in the related service.
   *
   * Receives the current item from the context result and the full hook context as arguments.
   * Can return a single data object, an array of data objects, or a promise that resolves to either.
   *
   * If the function returns undefined, no related record will be created for that item.
   */
  data: (
    item: ResultSingleHookContext<H>,
    context: H,
  ) => Promisable<MaybeArray<InferCreateDataSingle<Services[S]>> | undefined>
  /**
   * Whether the hook waits for the related records to be created before the
   * call continues. Can be a boolean or a predicate that receives the
   * `HookContext`.
   *
   * When not blocking, the related records are created in the background and
   * the call does not wait for them. The `data` function still runs in the
   * hook chain, on the result as it is at this point, and an error in it is
   * still thrown to the caller.
   *
   * @example isProvider('external')
   * @default true
   */
  blocking?: boolean | PredicateFn<H>
  /**
   * Called when creating the related records fails while not blocking.
   * Without this, the error is swallowed (but never leaks as an unhandled
   * rejection). In `blocking` mode the error is thrown to the caller instead.
   */
  onError?: (error: any, context: H) => void
}

/**
 * Creates related records in other services after a successful `create` call.
 * For each result item, a `data` function produces the record to create in the target service.
 * They are created in a single multi-create if the related service allows it,
 * otherwise with one call per item. With `blocking: false` they are created in
 * the background, without holding up the call.
 *
 * @example
 * ```ts
 * import { createRelated } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   after: {
 *     create: [createRelated({ service: 'profiles', data: (user) => ({ userId: user.id }) })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/create-related.html
 */
export function createRelated<H extends HookContext = HookContext>(
  options: MaybeArray<CreateRelatedOptions<H>>,
) {
  return async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, {
      type: ['after', 'around'],
      method: ['create'],
      label: 'createRelated',
    })

    if (next) {
      await next()
    }

    const { result } = getResultIsArray(context)

    const entries = Array.isArray(options) ? options : [options]

    await Promise.all(
      entries.map(async (entry) => {
        const { data, service, multi, blocking = true, onError } = entry

        const dataToCreate = (
          await Promise.all(result.map(async (item) => data(item, context)))
        )
          .flat()
          .filter((x) => !!x)

        if (!dataToCreate || dataToCreate.length <= 0) {
          return
        }

        const isBlocking =
          typeof blocking === 'function' ? await blocking(context) : blocking

        const promise = createMany(
          context.app,
          service as string,
          dataToCreate as any,
          { multi },
        )

        if (isBlocking) {
          await promise
          return
        }

        // fire-and-forget: always attach a catch so a rejection never becomes
        // an unhandled promise rejection. Surface it via `onError` if provided.
        promise.catch((error) => onError?.(error, context))
      }),
    )
  }
}
