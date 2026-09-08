import type { Application, Params } from '@feathersjs/feathers'
import { changeMany } from '../../common/index.js'
import type { KeyOf } from '../../internal.utils.js'
import type { Multi } from '../../types.js'
import type {
  InferFindParams,
  InferFindResultSingle,
  InferPatchData,
} from '../../utility-types/infer-service-methods.js'

export type PatchManyOptions = {
  /**
   * Whether the service allows patching multiple items in a single call.
   *
   * Defaults to the `multi` option of the service. If multi patching is not
   * allowed, the matching items are fetched and patched with one call per item.
   */
  multi?: Multi
}

/**
 * Patches all items matching `params` with a single `patch(null, ...)` call.
 *
 * If the service does not allow multi patching (its `multi` option, or an
 * explicit `multi` option), the matching items are fetched with `find` and
 * patched with one call per item instead - so it works regardless of the
 * service's `multi` configuration.
 *
 * @example
 * ```ts
 * import { patchMany } from 'feathers-utils/utils'
 *
 * // one `patch(null, ...)` call, or one `patch(id, ...)` call per item
 * const todos = await patchMany(app, 'todos', { userId: null }, {
 *   query: { userId: 1 },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/patch-many.html
 */
export async function patchMany<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  P extends Params = InferFindParams<Service>,
  Item = InferFindResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  data: InferPatchData<Service>,
  params?: P,
  options?: PatchManyOptions,
): Promise<Item[]> {
  const service = app.service(servicePath)

  if (!service || !('patch' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'patch' method.`)
  }

  return await changeMany(service, 'patch', data, params, options?.multi)
}
