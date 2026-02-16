import type { Paginated } from '@feathersjs/feathers'

/**
 * Ensures a result is in Feathers paginated format (`{ total, limit, skip, data }`).
 * If the input is already paginated, it is returned as-is. If it is a plain array,
 * it is wrapped in a paginated object with `total` and `limit` set to the array length.
 *
 * @example
 * ```ts
 * import { toPaginated } from 'feathers-utils/utils'
 *
 * const paginated = toPaginated([{ id: 1 }, { id: 2 }])
 * // => { total: 2, limit: 2, skip: 0, data: [{ id: 1 }, { id: 2 }] }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/to-paginated.html
 */
export function toPaginated<R>(result: R[] | Paginated<R>): Paginated<R> {
  if (Array.isArray(result)) {
    return {
      total: result.length,
      limit: result.length,
      skip: 0,
      data: result,
    }
  }
  return result
}
