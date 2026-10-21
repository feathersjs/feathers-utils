import type { Application, Params } from '@feathersjs/feathers'
import { findAllOf } from '../../common/find-all.js'
import type { FindAllParams } from '../../common/find-all.js'
import type { KeyOf } from '../../internal.utils.js'
import type {
  InferFindParams,
  InferFindResultSingle,
} from '../../utility-types/infer-service-methods.js'

export type FindAllOptions = {
  /**
   * Whether to call the `_find` of the adapter instead of `find` - directly,
   * without the hooks of the service.
   *
   * @default false
   */
  underscore?: boolean
}

/**
 * Finds all items matching `params` and returns them as an array - for
 * services with and without pagination. `paginate: false` is set last, so
 * `params` can't turn it off; if the service paginates anyway, like a custom
 * service that ignores `params.paginate`, the items of its page are returned.
 *
 * It loads all matching items at once - `paginate.max` does not apply with
 * `paginate: false`. For large sets, `iterateFind` and `chunkFind` load them
 * page by page. With `underscore: true`, it calls the `_find` of the adapter,
 * without the hooks of the service.
 *
 * @example
 * ```ts
 * import { findAll } from 'feathers-utils/utils'
 *
 * const users = await findAll(app, 'users', { query: { active: true } })
 * // => User[], whether `users` paginates or not
 * ```
 *
 * @see https://utils.feathersjs.com/utils/find-all.html
 */
export async function findAll<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
  Item = InferFindResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  params?: P & FindAllParams,
  options?: FindAllOptions,
): Promise<Item[]> {
  const service: any = app.service(servicePath)
  const method = options?.underscore ? '_find' : 'find'

  if (typeof service?.[method] !== 'function') {
    throw new Error(
      `Service '${servicePath}' does not have a '${method}' method.`,
    )
  }

  return await findAllOf(service, params, options)
}
