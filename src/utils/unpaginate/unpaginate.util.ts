import type { Paginated } from '@feathersjs/feathers'

/**
 * Extracts the items from a find result that may or may not be paginated.
 * A plain array is returned as-is, a paginated result yields its `data`, and
 * `undefined`/`null` yields an empty array - so a `find` can be consumed without
 * knowing whether pagination is enabled for the service or disabled via
 * `params.paginate: false`.
 *
 * This is the lossy counterpart to `toPaginated`: `total`, `limit` and `skip`
 * are dropped, so `unpaginate(toPaginated(x))` round-trips but the reverse does
 * not. The returned array MUST be treated as read-only - it is the input array
 * or the paginated result's `data`, never a copy.
 *
 * @example
 * ```ts
 * import { unpaginate } from 'feathers-utils/utils'
 *
 * const items = unpaginate(await service.find(params))
 * // => [{ id: 1 }, { id: 2 }]
 * ```
 *
 * @see https://utils.feathersjs.com/utils/unpaginate.html
 */
export function unpaginate<R>(
  result: R[] | Paginated<R> | undefined | null,
): R[] {
  if (Array.isArray(result)) {
    return result
  }

  return result?.data ?? []
}
