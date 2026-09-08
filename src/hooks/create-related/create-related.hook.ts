import type { HookContext, NextFunction } from '@feathersjs/feathers'
import {
  checkContext,
  createMany,
  getResultIsArray,
} from '../../utils/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { Multi } from '../../types.js'
import type { InferCreateDataSingle } from '../../utility-types/infer-service-methods.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'

export interface CreateRelatedOptions<
  H extends HookContext = HookContext,
  Services extends H['app']['services'] = H['app']['services'],
  S extends keyof Services = keyof Services,
> {
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
}

/**
 * Creates related records in other services after a successful `create` call.
 * For each result item, a `data` function produces the record to create in the target service.
 * They are created in a single multi-create if the related service allows it,
 * otherwise with one call per item.
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
        const { data, service, multi } = entry

        const dataToCreate = (
          await Promise.all(result.map(async (item) => data(item, context)))
        )
          .flat()
          .filter((x) => !!x)

        if (!dataToCreate || dataToCreate.length <= 0) {
          return
        }

        await createMany(context.app, service as string, dataToCreate as any, {
          multi,
        })
      }),
    )
  }
}
