import type { Application, Params } from '@feathersjs/feathers'
import { changeMany } from '../../common/index.js'
import type { KeyOf } from '../../internal.utils.js'
import type { Multi } from '../../types.js'
import type {
  InferFindParams,
  InferFindResultSingle,
} from '../../utility-types/infer-service-methods.js'

export type RemoveManyOptions = {
  /**
   * Whether the service allows removing multiple items in a single call.
   *
   * Defaults to the `multi` option of the service. If multi removing is not
   * allowed, the matching items are fetched and removed with one call per item.
   */
  multi?: Multi
}

/**
 * Removes all items matching `params` with a single `remove(null, ...)` call.
 *
 * If the service does not allow multi removing (its `multi` option, or an
 * explicit `multi` option), the matching items are fetched with `find` and
 * removed with one call per item instead - so it works regardless of the
 * service's `multi` configuration.
 *
 * @example
 * ```ts
 * import { removeMany } from 'feathers-utils/utils'
 *
 * // one `remove(null, ...)` call, or one `remove(id, ...)` call per item
 * const todos = await removeMany(app, 'todos', { query: { userId: 1 } })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/remove-many.html
 */
export async function removeMany<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
  Item = InferFindResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  params?: P,
  options?: RemoveManyOptions,
): Promise<Item[]> {
  const service = app.service(servicePath)

  if (!service || !('remove' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'remove' method.`)
  }

  return await changeMany(service, 'remove', undefined, params, options?.multi)
}
