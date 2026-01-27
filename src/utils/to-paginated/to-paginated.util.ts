import type { Paginated } from '@feathersjs/feathers'

/**
 * Ensure the result is in paginated format
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
