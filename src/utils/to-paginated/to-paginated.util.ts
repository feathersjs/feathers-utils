import type { Paginated } from '@feathersjs/feathers'

/**
 * Ensure the result is in paginated format
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
