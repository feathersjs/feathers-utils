import type { Application, Params } from '@feathersjs/feathers'
import type { KeyOf } from '../../internal.utils.js'
import type {
  InferFindParams,
  InferFindResultSingle,
} from '../../utility-types/infer-service-methods.js'

type ChunkFindOptions<P extends Params = Params> = {
  params?: P
}

/**
 * Use `for await` to iterate over chunks (pages) of results from a `find` method.
 *
 * This function is useful for processing large datasets in batches without loading everything into memory at once.
 * It uses pagination to fetch results in chunks, yielding each page's data array.
 *
 * @example
 * ```ts
 * import { chunkFind } from 'feathers-utils/utils'
 *
 * const app = feathers()
 *
 * // Assuming 'users' service has many records
 * for await (const users of chunkFind(app, 'users', {
 *  params: { query: { active: true }, // Custom query parameters
 * } })) {
 *  console.log(users) // Process each chunk of user records
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/chunk-find.html
 */
export async function* chunkFind<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
  Item = InferFindResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  options?: ChunkFindOptions<P>,
): AsyncGenerator<Item[], void, unknown> {
  const service = app.service(servicePath)

  if (!service || !('find' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'find' method.`)
  }

  const params = {
    ...options?.params,
    query: {
      ...(options?.params?.query ?? {}),
      $limit: options?.params?.query?.$limit ?? 10,
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

    yield result.data

    params.query.$skip = (params.query.$skip ?? 0) + result.data.length
  } while (result.total > params.query.$skip)
}
