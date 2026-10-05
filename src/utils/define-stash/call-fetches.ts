import type { HookContext, Id, Params } from '@feathersjs/feathers'
import { findAllOf } from '../../common/find-all.js'
import { isEqual } from '../../common/is-equal.js'
import { selectCovers } from '../../common/select-covers.js'
import { snapshot } from '../../common/snapshot.js'
import { addToQuery } from '../add-to-query/add-to-query.util.js'
import { getIdField } from '../get-id-field/get-id-field.util.js'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'

export type ItemsById = Map<string, { id: Id; item: any }>

type Fetch = {
  /** a snapshot of the params the items are fetched with */
  params: Params
  items: Promise<ItemsById>
}

/**
 * The fetches of one call, shared by everything that reads its items - every
 * `defineStash()` and `getMergedData`
 */
export type CallFetches = {
  before: Fetch[]
  after: Fetch[]
}

/**
 * Keyed by the context, which lives exactly as long as the call. `params`
 * would leak: callers reuse one `params` object for concurrent calls and pass
 * `{ ...context.params }` on to nested calls.
 */
const callFetches = new WeakMap<HookContext, CallFetches>()

export const getCallFetches = (context: HookContext): CallFetches => {
  let fetches = callFetches.get(context)
  if (!fetches) {
    fetches = { before: [], after: [] }
    callFetches.set(context, fetches)
  }
  return fetches
}

export const byId = (items: any[], idField: string): ItemsById => {
  const map: ItemsById = new Map()
  for (const item of items) {
    map.set(String(item[idField]), { id: item[idField], item })
  }
  return map
}

/**
 * The params the items before the call are fetched with: those of the call,
 * without `$select`, to get the whole items. `find` for a call with an id as
 * well, so the items before and after the call go through the same hooks.
 */
export const paramsBefore = (context: HookContext): Params => {
  const { $select: _, ...query } = context.params.query ?? {}
  return {
    ...context.params,
    query:
      context.id == null
        ? query
        : addToQuery(query, { [getIdField(context.service)]: context.id }),
    paginate: false,
  }
}

/** The params without `query.$select`, and the `$select` */
const splitSelect = (params: Params): [Params, unknown] => {
  if (!params.query || !('$select' in params.query)) return [params, undefined]
  const { $select, ...query } = params.query
  return [{ ...params, query }, $select]
}

/**
 * Whether a fetch with `select` returns every field `requested` asks for - all
 * of them only without a `$select` of its own
 */
const covers = (
  select: unknown,
  requested: unknown,
  idField: string,
): boolean =>
  requested === undefined
    ? select === undefined
    : selectCovers(
        select,
        Array.isArray(requested) ? requested : [requested],
        idField,
      )

/**
 * The first fetch of the call with these params fetches the items, the others
 * reuse them - as well as a fetch whose params only differ in a broader
 * `$select`, or none: its items have all the fields asked for. Finding and
 * adding the fetch is synchronous, so two of them can't both start the same
 * fetch.
 */
export const fetchShared = (
  fetches: Fetch[],
  params: Params,
  fetch: (params: Params) => Promise<any[]>,
  idField: string,
): Promise<ItemsById> => {
  const [rest, select] = splitSelect(params)
  const shared = fetches.find((f) => {
    const [fetchedRest, fetchedSelect] = splitSelect(f.params)
    return covers(fetchedSelect, select, idField) && isEqual(fetchedRest, rest)
  })
  if (shared) return shared.items

  // taken before the fetch, whose hooks may change the params
  const snapshotOfParams = snapshot(params)
  // a copy of its own as well: the params share their nested objects with the
  // params of the call, which the hooks of the fetch must not write into -
  // feathers-casl, for one, keeps its state of the call on `params.casl`
  const items = fetch(snapshot(params)).then((items) => byId(items, idField))
  fetches.push({ params: snapshotOfParams, items })
  return items
}

/**
 * The items of the call as they are stored before it, fetched once per call:
 * with `properties`, only those and the id are selected, without them the
 * whole items - a fetch every other one of the call can reuse
 */
export const fetchStored = (
  context: HookContext,
  properties?: readonly string[],
): Promise<ItemsById> => {
  const idField = getIdField(context.service)
  const params = paramsBefore(context)

  return fetchShared(
    getCallFetches(context).before,
    properties
      ? {
          ...params,
          query: {
            ...params.query,
            $select: properties.includes(idField)
              ? properties
              : [idField, ...properties],
          },
        }
      : params,
    (params) => findAllOf(context.service, params),
    idField,
  )
}

/**
 * The items of the result, with `properties` - fetched again by id with only
 * those if the `$select` of the call left one of them out
 */
export const resultWith = async (
  context: HookContext,
  properties: readonly string[],
): Promise<any[]> => {
  const { result } = getResultIsArray(context)
  const idField = getIdField(context.service)
  if (
    !result.length ||
    selectCovers(context.params.query?.$select, properties, idField)
  ) {
    return result
  }

  return await findAllOf(context.service, {
    ...context.params,
    query: {
      [idField]: { $in: result.map((item: any) => item[idField]) },
      $select: [idField, ...properties],
    },
  })
}
