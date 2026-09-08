import type { Params } from '@feathersjs/feathers'
import type { Multi } from '../types.js'
import { allowsMulti } from './allows-multi.js'
import { toArray } from './to-array.js'

/**
 * Filters that select *which* items are affected. They are consumed by the
 * `find` of the single-call fallback and must not be forwarded to the
 * per-item calls.
 */
const selectionFilters = ['$limit', '$skip', '$sort'] as const

const toSingleParams = (params: Params | undefined): Params => {
  const { query, ...rest } = params ?? {}

  if (!query) {
    return rest
  }

  const singleQuery = { ...query }

  for (const filter of selectionFilters) {
    delete singleQuery[filter]
  }

  return { ...rest, query: singleQuery }
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

  const found = await service.find(multiParams)
  const items: any[] = Array.isArray(found) ? found : (found?.data ?? [])

  if (!items.length) {
    return []
  }

  const idProperty: string = service.id ?? 'id'
  const singleParams = toSingleParams(params)

  return await Promise.all(
    items.map(async (item) =>
      method === 'patch'
        ? await service.patch(item[idProperty], data, singleParams)
        : await service.remove(item[idProperty], singleParams),
    ),
  )
}
