import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext, getResultIsArray } from '../../utils/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
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
   * If true, will create multiple related records in a single call to the related service's create method.
   * If false or not provided, will create related records one by one.
   *
   * @default false
   */
  multi?: boolean
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
 * Supports creating records one-by-one or in a single multi-create when `multi: true`.
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
  return async (context: H, next?: NextFunction) => {
    checkContext(context, ['after', 'around'], ['create'], 'createRelated')

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
          return context
        }

        if (multi || dataToCreate.length === 1) {
          await context.app
            .service(service as string)
            .create(
              dataToCreate.length === 1
                ? (dataToCreate[0] as any)
                : (dataToCreate as any),
            )
        } else {
          await Promise.all(
            dataToCreate.map(async (item) =>
              context.app.service(service as string).create(item as any),
            ),
          )
        }
      }),
    )
  }
}
