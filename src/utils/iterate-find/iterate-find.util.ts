import type { Application, Params } from '@feathersjs/feathers'
import type { KeyOf } from '../../internal.utils.js'
import type {
  InferFindParams,
  InferFindResultSingle,
} from '../../utility-types/infer-service-methods.js'

type PaginateOption = { default?: number; max?: number }

type IterateFindOptions<P extends Params = Params> = {
  params?: P & { paginate?: PaginateOption }
}

/**
 * Use `for await` to iterate over the results of a `find` method.
 *
 * This function is useful for iterating over large datasets without loading everything into memory at once.
 * It uses pagination to fetch results in chunks, allowing you to process each item as it is retrieved.
 *
 * @example
 * ```ts
 * import { iterateFind } from 'feathers-utils/utils'
 *
 * const app = feathers()
 *
 * // Assuming 'users' service has many records
 * for await (const user of iterateFind(app, 'users', {
 *  params: { query: { active: true }, // Custom query parameters
 * } })) {
 *  console.log(user) // Process each user record
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/iterate-find.html
 */
export async function* iterateFind<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
  Item = InferFindResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  options?: IterateFindOptions<P>,
): AsyncGenerator<Item, void, unknown> {
  const service = app.service(servicePath)

  if (!service || !('find' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'find' method.`)
  }

  const params = {
    ...options?.params,
    query: {
      ...(options?.params?.query ?? {}),
      $limit: options?.params?.query?.$limit,
      $skip: options?.params?.query?.$skip ?? 0,
    },
    paginate: {
      default: options?.params?.paginate?.default ?? 10,
      max: options?.params?.paginate?.max ?? 100,
    },
  }

  let result

  do {
    result = await (service as any).find(params)

    // Guard against an infinite loop: an empty page never advances $skip, so
    // `total > $skip` could stay true forever (e.g. $limit:0, or a stale total
    // when items are concurrently removed / filtered out by hooks).
    if (!result.data.length) {
      break
    }

    for (const item of result.data) {
      yield item
    }

    params.query.$skip = (params.query.$skip ?? 0) + result.data.length
  } while (result.total > params.query.$skip)
}
