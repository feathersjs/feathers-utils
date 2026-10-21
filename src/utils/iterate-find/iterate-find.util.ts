import type { Application, Params } from '@feathersjs/feathers'
import { findPages } from '../../common/index.js'
import type { KeyOf } from '../../internal.utils.js'
import type {
  InferFindParams,
  InferFindResultSingle,
} from '../../utility-types/infer-service-methods.js'

type PaginateOption = { default?: number; max?: number }

export type IterateFindOptions<P extends Params = Params> = {
  /**
   * The params of every `find` call. `query.$limit` is the page size, capped by
   * `paginate.max`; `paginate` defaults to `{ default: 10, max: 100 }`.
   */
  params?: P & { paginate?: PaginateOption }
  /**
   * Page by the id instead of by `$skip`: every page asks for the items after
   * the last id of the page before, sorted by id.
   *
   * Use it when the loop changes items so that they leave the query, or when
   * others write to the service meanwhile - with `$skip` the pages shift, so
   * items are skipped or seen twice. It also stays linear on large tables,
   * where the database reads and discards every skipped row per page, and it
   * needs no `total`, so the `find` calls run with `paginate: false`.
   *
   * The items come sorted by id, so a `query.$sort` throws. The id is added to
   * a `query.$select` that leaves it out.
   *
   * @default false
   */
  keyset?: boolean
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

  for await (const page of findPages(service, options)) {
    for (const item of page) {
      yield item
    }
  }
}
