import type { HookContext } from '@feathersjs/feathers'
import { getResultIsArray } from '../../utils/get-result-is-array/get-result-is-array.util.js'
import { zipDataResult } from '../../utils/zip-data-result/zip-data-result.util.js'

/** An item of `context.data` as it was when `data` tested it, and whether it matched */
export type DataMatch = { data: unknown; isMatch: boolean }

/**
 * The ids of the items whose data matched `data` on multi create. The data is
 * paired with the result as it was when `data` tested it - a later hook may
 * have changed `context.data`. An item that can't be paired with its data
 * doesn't match.
 *
 * Data with an id is paired by its id. Data without one only by its position,
 * and only while the result has as many items as the data had - once a later
 * hook added or removed an item, the positions no longer line up. Internal
 * helper for {@link trigger}.
 */
export const getDataMatchIds = (
  context: HookContext,
  dataMatches: DataMatch[],
): Set<string> => {
  const idField: string = context.service?.id ?? 'id'
  const ids = new Set<string>()

  // only what `zipDataResult` reads: a context can't be spread
  const zipContext = {
    type: context.type,
    method: context.method,
    service: context.service,
    data: dataMatches.map(({ data }) => data),
    result: context.result,
  } as HookContext
  const pairs = zipDataResult(zipContext, { by: 'id' })
  const isPairedByPosition =
    getResultIsArray(zipContext).result.length === dataMatches.length

  dataMatches.forEach(({ data, isMatch }, i) => {
    const hasId = (data as any)?.[idField] != null
    const result: any = pairs[i]?.result
    if (isMatch && result && (hasId || isPairedByPosition)) {
      ids.add(String(result[idField]))
    }
  })

  return ids
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  const contextOf = (result: unknown, id = 'id') =>
    ({ type: 'after', method: 'create', service: { id }, result }) as any
  const match = (data: unknown) => ({ data, isMatch: true })
  const noMatch = (data: unknown) => ({ data, isMatch: false })

  describe('getDataMatchIds', () => {
    it('pairs data without ids by position', () => {
      const context = contextOf([{ id: 0 }, { id: 1 }, { id: 2 }])

      const ids = getDataMatchIds(context, [match({}), noMatch({}), match({})])

      expect([...ids]).toEqual(['0', '2'])
    })

    it('pairs data with ids by id, whatever order the result has', () => {
      const context = contextOf([{ id: 2 }, { id: 1 }, { id: 0 }])

      const ids = getDataMatchIds(context, [
        match({ id: 0 }),
        noMatch({ id: 1 }),
        noMatch({ id: 2 }),
      ])

      expect([...ids]).toEqual(['0'])
    })

    it("doesn't pair data without ids once the result has another length", () => {
      // a later hook removed the first item
      const context = contextOf([{ id: 0 }, { id: 1 }])

      const ids = getDataMatchIds(context, [match({}), noMatch({}), match({})])

      expect([...ids]).toEqual([])
    })

    it('still pairs data with ids once the result has another length', () => {
      const context = contextOf([{ id: 1 }, { id: 2 }])

      const ids = getDataMatchIds(context, [
        match({ id: 0 }),
        noMatch({ id: 1 }),
        match({ id: 2 }),
      ])

      expect([...ids]).toEqual(['2'])
    })

    it("uses the service's id field", () => {
      const context = contextOf([{ _id: 'a' }, { _id: 'b' }], '_id')

      const ids = getDataMatchIds(context, [noMatch({}), match({ _id: 'b' })])

      expect([...ids]).toEqual(['b'])
    })

    it("doesn't match data without a result", () => {
      const context = contextOf([{ id: 0 }])

      const ids = getDataMatchIds(context, [match({ id: 1 })])

      expect([...ids]).toEqual([])
    })
  })
}
