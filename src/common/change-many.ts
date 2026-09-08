import type { Params } from '@feathersjs/feathers'
import type { Multi } from '../types.js'
import { allowsMulti } from './allows-multi.js'
import { toArray } from './to-array.js'

/**
 * The query selects *which* items are affected. It is consumed by the `find`
 * of the per-item fallback and must not be forwarded to the per-item calls -
 * only `$select` is kept, so both paths return the same shape.
 */
const toSingleParams = (params: Params | undefined): Params => {
  const { query, ...rest } = params ?? {}

  if (!query?.$select) {
    return rest
  }

  return { ...rest, query: { $select: query.$select } }
}

/**
 * The `find` of the per-item fallback is only there to collect the ids, so it
 * replaces `$select` with the id property - the per-item calls apply the
 * caller's `$select` to shape what is returned.
 */
const toFindParams = (params: Params | undefined, idProperty: string) => {
  const { $select, ...query } = params?.query ?? {}

  return {
    ...params,
    query: { ...query, $select: [idProperty] },
    paginate: false as const,
  }
}

/**
 * Changes all items matching `params` with a single `patch`/`remove` call.
 *
 * If the service does not allow multi for the method, the matching items are
 * fetched with `find` and changed with one call per item instead.
 */
export const changeMany = async (
  service: any,
  method: 'patch' | 'remove',
  data: any,
  params: Params | undefined,
  multi: Multi | undefined,
): Promise<any[]> => {
  const multiParams = { ...params, paginate: false as const }

  if (allowsMulti(service, method, multi)) {
    const result =
      method === 'patch'
        ? await service.patch(null, data, multiParams)
        : await service.remove(null, multiParams)

    return toArray(result)
  }

  const idProperty: string = service.id ?? 'id'

  const found = await service.find(toFindParams(params, idProperty))
  const items: any[] = Array.isArray(found) ? found : (found?.data ?? [])

  if (!items.length) {
    return []
  }

  const singleParams = toSingleParams(params)

  return await Promise.all(
    items.map(async (item) =>
      method === 'patch'
        ? await service.patch(item[idProperty], data, singleParams)
        : await service.remove(item[idProperty], singleParams),
    ),
  )
}
