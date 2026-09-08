import type { Application } from '@feathersjs/feathers'
import { allowsMulti, toArray } from '../../common/index.js'
import type { KeyOf } from '../../internal.utils.js'
import type { Multi } from '../../types.js'
import type {
  InferCreateDataSingle,
  InferCreateResultSingle,
} from '../../utility-types/infer-service-methods.js'

export type CreateManyOptions = {
  /**
   * Whether the service allows creating multiple items in a single call.
   *
   * Defaults to the `multi` option of the service. If multi creating is not
   * allowed, the items are created with one call per item.
   */
  multi?: Multi
}

/**
 * Creates all given items with a single `create([...])` call.
 *
 * If the service does not allow multi creating (its `multi` option, or an
 * explicit `multi` option), the items are created with one call per item
 * instead - so it works regardless of the service's `multi` configuration.
 * A single item is always created with a single call.
 *
 * @example
 * ```ts
 * import { createMany } from 'feathers-utils/utils'
 *
 * // one `create([...])` call, or one `create({...})` call per item
 * const todos = await createMany(app, 'todos', [
 *   { title: 'Buy milk', userId: 1 },
 *   { title: 'Buy eggs', userId: 1 },
 * ])
 * ```
 *
 * @see https://utils.feathersjs.com/utils/create-many.html
 */
export async function createMany<
  Services,
  Path extends KeyOf<Services>,
  Service extends Services[Path] = Services[Path],
  Item = InferCreateResultSingle<Service>,
>(
  app: Application<Services>,
  servicePath: Path,
  data: InferCreateDataSingle<Service>[],
  options?: CreateManyOptions,
): Promise<Item[]> {
  const service = app.service(servicePath) as any

  if (!service || !('create' in service)) {
    throw new Error(`Service '${servicePath}' does not have a 'create' method.`)
  }

  if (!data.length) {
    return []
  }

  // a single item never needs multi
  if (data.length === 1) {
    return toArray(await service.create(data[0]))
  }

  if (allowsMulti(service, 'create', options?.multi)) {
    return toArray(await service.create(data))
  }

  return await Promise.all(data.map(async (item) => service.create(item)))
}
