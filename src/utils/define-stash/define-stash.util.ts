import type {
  HookContext,
  Id,
  NextFunction,
  Params,
} from '@feathersjs/feathers'
import { findAllOf } from '../../common/find-all.js'
import { isEqual } from '../../common/is-equal.js'
import { snapshot } from '../../common/snapshot.js'
import { checkContext } from '../check-context/check-context.util.js'
import { getIdField } from '../get-id-field/get-id-field.util.js'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import {
  byId,
  fetchShared,
  getCallFetches,
  paramsBefore,
  type ItemsById,
} from './call-fetches.js'

/**
 * Like `TransformParamsFn`, but may be async and gets the context
 */
export type StashTransformParams<H extends HookContext = HookContext> = (
  params: Params,
  context: H,
) => Params | void | Promise<Params | void>

export type StashOptions<H extends HookContext = HookContext> = {
  /**
   * Fetches the items before the call. Without it, `before` stays
   * `undefined`, but `result` is still refetched for `transformParams` or
   * `$select`.
   *
   * @default true
   */
  fetchBefore?: boolean
  /**
   * Adjusts the params of both fetches, before and after the call - e.g. to
   * populate the items. Gets a copy of the params, so it may change them in
   * place, nested objects included. The query of the call is still in
   * `context.params.query`.
   *
   * @example
   * ```ts
   * defineStash({
   *   transformParams: (params) => ({ ...params, $populate: ['profile'] }),
   * })
   * ```
   */
  transformParams?: StashTransformParams<H>
}

export type StashedItem<T = any> = {
  id: Id
  /**
   * The item before the call. `undefined` on `create`, without `fetchBefore`,
   * or if it wasn't found before the call.
   */
  before: T | undefined
  /**
   * The item after the call. `undefined` until the call ran, or if the
   * refetch didn't return it. On `remove`, the removed item.
   */
  result: T | undefined
}

export type Stash<T = any, H extends HookContext = HookContext> = {
  /**
   * Fetches the items before the call and waits for them, so the call can't
   * overtake the fetch. A `before` or `around` hook, or called from one
   * before `next()`.
   */
  stash: (context: H, next?: NextFunction) => Promise<void>
  /**
   * The items of the call: before the call with `before` only, after the
   * call paired with `result` by id.
   */
  stashed: (context: H) => Promise<StashedItem<T>[]>
}

type Entry = {
  before: Promise<ItemsById | undefined>
  stashed?: Promise<StashedItem[]>
}

/**
 * Per `defineStash()`, keyed by the context like the fetches the stashes
 * share (see `call-fetches.ts`)
 */
const callEntries = new WeakMap<HookContext, Map<symbol, Entry>>()

const getCallEntries = (context: HookContext): Map<symbol, Entry> => {
  let entries = callEntries.get(context)
  if (!entries) {
    entries = new Map()
    callEntries.set(context, entries)
  }
  return entries
}

/**
 * Stashes the items of a call before it runs, to compare them with the items
 * after it. Returns a pair: `stash` fetches the items before the call,
 * `stashed` returns them - paired with the items after the call once it ran.
 *
 * Every `defineStash()` is its own stash. Stashes of one call with equal
 * params share their fetches. Nothing is stored on `params`, so concurrent
 * calls with one `params` object and nested calls stay apart.
 *
 * `stash` and `stashed` without options are exported as well.
 *
 * @example
 * ```ts
 * import { defineStash } from 'feathers-utils/utils'
 *
 * const { stash, stashed } = defineStash<User>()
 *
 * app.service('users').hooks({
 *   before: { patch: [stash] },
 *   after: {
 *     patch: [
 *       async (context) => {
 *         for (const { before, result } of await stashed(context)) {
 *           if (before?.email !== result?.email) await sendMail(result)
 *         }
 *       },
 *     ],
 *   },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/define-stash.html
 */
export function defineStash<T = any, H extends HookContext = HookContext>(
  options?: StashOptions<H>,
): Stash<T, H> {
  const token = Symbol('stash')

  const stash = async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, {
      type: ['before', 'around'],
      method: ['create', 'update', 'patch', 'remove'],
      label: 'stash',
    })

    // `context.type` stays 'around' after `next()`, the result tells
    if (context.result !== undefined) {
      throw new Error(
        "stash: the call already ran - use it in a before hook, or in an around hook before 'next()'",
      )
    }

    const entries = getCallEntries(context)
    let entry = entries.get(token)
    if (!entry) {
      entry = { before: fetchItemsBefore(context, options) }
      entries.set(token, entry)
    }

    await entry.before

    if (next) await next()
  }

  const stashed = async (context: H): Promise<StashedItem<T>[]> => {
    const entry = callEntries.get(context)?.get(token)
    if (!entry) {
      throw new Error(
        "stashed: nothing is stashed for this call - use 'stash' in a before hook, or in an around hook before 'next()'",
      )
    }

    if (context.result === undefined) {
      const before = await entry.before
      return before
        ? [...before.values()].map(({ id, item }) => ({
            id,
            before: item,
            result: undefined,
          }))
        : []
    }

    entry.stashed ??= pairWithResult(context, options, entry)
    return await entry.stashed
  }

  return { stash, stashed }
}

const transform = async <H extends HookContext>(
  params: Params,
  context: H,
  transformParams: StashTransformParams<H> | undefined,
): Promise<Params> => {
  if (!transformParams) return params
  // may be changed in place, nested objects included
  const copy = snapshot(params)
  return (await transformParams(copy, context)) ?? copy
}

const fetchItemsBefore = async <H extends HookContext>(
  context: H,
  options: StashOptions<H> | undefined,
): Promise<ItemsById | undefined> => {
  if (options?.fetchBefore === false || context.method === 'create') {
    return undefined
  }

  const params = await transform(
    paramsBefore(context),
    context,
    options?.transformParams,
  )

  return await fetchShared(
    getCallFetches(context).before,
    params,
    // all items, even if `transformParams` dropped `paginate: false` - one
    // page would leave the other items without `before` or `result`
    (params) => findAllOf(context.service, params),
    getIdField(context.service),
  )
}

/**
 * The items after the call from `context.result`, refetched by id if
 * `transformParams` or `$select` make the result unfit
 */
const fetchItemsAfter = async <H extends HookContext>(
  context: H,
  options: StashOptions<H> | undefined,
  resultById: ItemsById,
  idField: string,
): Promise<ItemsById> => {
  if (context.method === 'remove' || !resultById.size) return resultById

  const params: Params = {
    ...context.params,
    query: { [idField]: { $in: [...resultById.values()].map(({ id }) => id) } },
    paginate: false,
  }
  const transformed = await transform(params, context, options?.transformParams)

  // without `$select`, `context.result` is what this refetch would return
  if (!context.params.query?.$select && isEqual(transformed, params)) {
    return resultById
  }

  return await fetchShared(
    getCallFetches(context).after,
    transformed,
    // all items, even if `transformParams` dropped `paginate: false` - one
    // page would leave the other items without `before` or `result`
    (params) => findAllOf(context.service, params),
    idField,
  )
}

const pairWithResult = async <H extends HookContext>(
  context: H,
  options: StashOptions<H> | undefined,
  entry: Entry,
): Promise<StashedItem[]> => {
  const idField = getIdField(context.service)
  const resultById = byId(getResultIsArray(context).result, idField)

  const [before, after] = await Promise.all([
    entry.before,
    fetchItemsAfter(context, options, resultById, idField),
  ])

  return [...resultById.values()].map(({ id }) => ({
    id,
    before: before?.get(String(id))?.item,
    result: after.get(String(id))?.item,
  }))
}

/**
 * `stash` and `stashed` without options
 *
 * @example
 * ```ts
 * import { stash, stashed } from 'feathers-utils/utils'
 *
 * app.service('users').hooks({
 *   before: {
 *     patch: [
 *       stash,
 *       async (context) => {
 *         const [{ before }] = await stashed(context)
 *         if (before?.locked) throw new Forbidden('locked')
 *       },
 *     ],
 *   },
 * })
 * ```
 */
export const { stash, stashed } = defineStash()
