import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext, getResultIsArray } from '../../utils/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'

export interface CreateRelatedOptions<S = Record<string, any>> {
  service: keyof S
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
   */
  data: (item: any, context: HookContext) => Promisable<Record<string, any>>
}

/**
 * Create related records in other services.
 *
 * @see https://utils.feathersjs.com/hooks/create-related.html
 */
export function createRelated<
  S = Record<string, any>,
  H extends HookContext = HookContext,
>(options: MaybeArray<CreateRelatedOptions<S>>) {
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
        ).filter((x) => !!x)

        if (!dataToCreate || dataToCreate.length <= 0) {
          return context
        }

        if (multi || dataToCreate.length === 1) {
          await context.app
            .service(service as string)
            .create(dataToCreate.length === 1 ? dataToCreate[0] : dataToCreate)
        } else {
          await Promise.all(
            dataToCreate.map(async (item) =>
              context.app.service(service as string).create(item),
            ),
          )
        }
      }),
    )
  }
}
