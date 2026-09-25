import type {
  Application,
  PaginationOptions,
  Params,
} from '@feathersjs/feathers'
import type { KeyOf } from '../../internal.utils.js'
import type { InferFindParams } from '../../utility-types/infer-service-methods.js'

/**
 * Counts the items matching `params` without loading them.
 *
 * Calls `find` with `$limit: 0` and returns the `total` of the paginated
 * result. Pagination is forced for this one call via `params.paginate`, so it
 * works for services with and without pagination - a `paginate: false` in
 * `params` included. The adapters then only run their counting query.
 *
 * A service that ignores `params.paginate` and returns an array makes it throw,
 * as an empty array cannot tell "no items" from "not counted". That is the case
 * for custom services, and for a client calling a server service without
 * pagination - `params.paginate` never reaches the server.
 *
 * @example
 * ```ts
 * import { count } from 'feathers-utils/utils'
 *
 * const openTodos = await count(app, 'todos', { query: { done: false } })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/count.html
 */
export async function count<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  params?: P & { paginate?: PaginationOptions | false },
): Promise<number> {
  const service = app.service(servicePath)

  if (!service || !('find' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'find' method.`)
  }

  const result = await (service as any).find({
    ...params,
    query: { ...params?.query, $limit: 0 },
    // knex and mongodb only paginate with a truthy `default`
    paginate: { default: 1 },
  })

  if (typeof result?.total !== 'number') {
    throw new Error(
      `Service '${servicePath}' did not return a paginated result, so its items cannot be counted.`,
    )
  }

  return result.total
}
