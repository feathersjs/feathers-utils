import type { PaginationOptions, Params } from '@feathersjs/feathers'
import type { FindAllOptions } from '../utils/find-all/find-all.util.js'
import { unpaginate } from '../utils/unpaginate/unpaginate.util.js'

export type FindAllParams = Params & {
  paginate?: PaginationOptions | false
}

/**
 * Finds all items of `service` matching `params`, as an array: with
 * `paginate: false`, set last so `params` can't turn it off - and the items of
 * the page, if the service paginates anyway. The core of the `findAll` util,
 * for callers that hold the service already.
 *
 * @example
 * ```ts
 * const items = await findAllOf(context.service, { query: { active: true } })
 * // without the hooks of the service
 * await findAllOf(context.service, params, { underscore: true })
 * ```
 */
export const findAllOf = async (
  service: any,
  params?: FindAllParams,
  options?: FindAllOptions,
): Promise<any[]> => {
  const all = { ...params, paginate: false }
  const result = options?.underscore
    ? await service._find(all)
    : await service.find(all)
  return unpaginate(result)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('findAllOf', () => {
    it('finds with paginate: false, whatever params says', async () => {
      const calls: Params[] = []
      const service = {
        find: async (params: Params) => {
          calls.push(params)
          return [{ id: 1 }]
        },
      }

      expect(
        await findAllOf(service, { query: { a: 1 }, paginate: { default: 1 } }),
      ).toEqual([{ id: 1 }])
      expect(calls).toEqual([{ query: { a: 1 }, paginate: false }])
    })

    it('calls _find instead of find with underscore: true', async () => {
      const service = {
        find: async () => [{ via: 'find' }],
        _find: async () => [{ via: '_find' }],
      }

      expect(await findAllOf(service)).toEqual([{ via: 'find' }])
      expect(await findAllOf(service, {}, { underscore: true })).toEqual([
        { via: '_find' },
      ])
    })

    it('returns the items of a page from a service that paginates anyway', async () => {
      const service = {
        find: async () => ({ total: 1, limit: 10, skip: 0, data: [{ id: 1 }] }),
      }

      expect(await findAllOf(service)).toEqual([{ id: 1 }])
    })
  })
}
