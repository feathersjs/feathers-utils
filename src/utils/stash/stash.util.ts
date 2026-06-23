import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import { dequal as deepEqual } from 'dequal'
import _omit from 'lodash/omit.js'

import type { HookContext, Id, Params } from '@feathersjs/feathers'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import type { Promisable } from '../../internal.utils.js'

export type Change<T = any> = {
  before: T
  item: T
}

export type Stash<T = any> = {
  [key: string]: Change<T>
  [key: number]: Change<T>
}

export type ManipulateParams<H extends HookContext = HookContext> = (
  params: Params,
  context: H,
) => Promisable<Params | null>

export interface StashOptions<H extends HookContext = HookContext> {
  /**
   * @default false
   */
  skipHooks: boolean
  params?: ManipulateParams<H>
  /**
   * @default []
   */
  deleteParams?: string[]
  /**
   * The name of the property to store the stash in `context.params`
   *
   * @default "stash"
   */
  name?: string | string[]
  /**
   * @default false
   */
  fetchBefore?: boolean
}

const defaultOptions = {
  skipHooks: false,
  params: undefined,
  name: 'stash',
  deleteParams: [],
  fetchBefore: false,
} satisfies Partial<StashOptions>

export interface StashParams extends Params {
  stash: any
}

declare module '@feathersjs/feathers' {
  interface Params {
    paginate?: any
    stash?: any
    /** Internal marker set on the (re)fetch params to prevent the stashing from recursing into itself. */
    _stash?: boolean
  }
}

/**
 * Captures the affected records of a `create`, `update`, `patch` or `remove`
 * call and writes the result to `context.params[name]` (default `stash`).
 *
 * It is phase-aware:
 * - In a `before` hook it stashes the pre-mutation state (when `fetchBefore` is
 *   enabled) at `context.params[name].itemsBefore`.
 * - In an `after` hook it computes the `Record<Id, { before, item }>` of all
 *   affected records, writes it to `context.params[name]` and returns it.
 *
 * Use it imperatively in your own `before`/`after` hooks, or use the
 * {@link stashable} hook which orchestrates both phases (and `around`).
 *
 * @example
 * ```ts
 * import { stash } from 'feathers-utils'
 *
 * // before hook
 * await stash(context, { fetchBefore: true })
 *
 * // after hook
 * const changes = await stash(context, { fetchBefore: true })
 * for (const id in changes) {
 *   const { before, item } = changes[id]
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/stashable.html
 */
export const stash = async <H extends HookContext, T = any>(
  context: H,
  _options?: Partial<StashOptions<H>>,
): Promise<Stash<T> | Record<Id, T> | T[] | undefined> => {
  const options = { ...defaultOptions, ..._options }

  if (context.type === 'before') {
    return stashBefore<H, T>(context, _options)
  }

  if (context.type === 'after') {
    return stashAfter<H, T>(context, _options)
  }

  // around: the before part has not run yet if `itemsBefore` is missing
  if (_get(context, getPath(options.name, true)) === undefined) {
    return stashBefore<H, T>(context, _options)
  }

  return stashAfter<H, T>(context, _options)
}

export const stashBefore = async <H extends HookContext, T = any>(
  context: H,
  _options?: Partial<StashOptions<H>>,
): Promise<Record<Id, T> | T[]> => {
  // skip the (re)fetches that the stashing triggers itself
  if (context.params?._stash) {
    return {}
  }

  const options = {
    ...defaultOptions,
    ..._options,
    type: 'before' as const,
  }

  let byId: Record<Id, T> | T[]

  if (context.method === 'create' || !options.fetchBefore) {
    byId = {}
  } else if (
    context.method === 'update' ||
    context.method === 'patch' ||
    context.method === 'remove'
  ) {
    byId = ((await getOrFindById(context, options)) ?? {}) as Record<Id, T>
  } else {
    byId = []
  }

  _set(context, getPath(options.name, true), byId)

  return byId
}

export const stashAfter = async <H extends HookContext, T = any>(
  context: H,
  _options?: Partial<StashOptions<H>>,
): Promise<Stash<T> | undefined> => {
  // skip the (re)fetches that the stashing triggers itself
  if (context.params?._stash) {
    return
  }

  const options = {
    ...defaultOptions,
    ..._options,
    type: 'after' as const,
  }

  const itemsBefore = _get(context, getPath(options.name, true))

  if (!itemsBefore) {
    return
  }

  const items = await resultById(context, options)

  if (!items) {
    return
  }
  const itemsBeforeOrAfter =
    context.method === 'remove' && options.fetchBefore ? itemsBefore : items

  const stash = Object.keys(itemsBeforeOrAfter).reduce(
    (result: Stash, id: string): Stash => {
      if (
        options.fetchBefore &&
        ((context.method !== 'create' && !itemsBefore[id]) ||
          (context.method !== 'remove' && !items[id]))
      ) {
        throw new Error('Mismatch!')
        //return result;
      }

      const before = itemsBefore[id]
      const item = items[id]

      result[id] = {
        before: before,
        item: item,
      }

      return result
    },
    {},
  )

  _set(context, getPath(options.name, false), stash)

  return stash as Stash<T>
}

export type GetOrFindByIdParamsOptions<H extends HookContext = HookContext> =
  Pick<StashOptions<H>, 'params' | 'skipHooks' | 'deleteParams'> & {
    type: 'before' | 'after'
  }

export const getOrFindByIdParams = async <H extends HookContext = HookContext>(
  context: H,
  options: GetOrFindByIdParamsOptions<H>,
): Promise<Params | undefined> => {
  if (context.id == null) {
    if (options.type === 'before') {
      const { stash: _stash, query: contextQuery, ...rest } = context.params
      const { $select, ...query } = contextQuery ?? {}

      const base: Params = { ...rest, query, paginate: false }
      const params = options.deleteParams?.length
        ? _omit(base, options.deleteParams)
        : base

      return (
        (typeof options.params === 'function'
          ? await options.params(params, context)
          : params) ?? {}
      )
    } else if (options.type === 'after') {
      if (!options.params && !context.params.query?.$select) {
        return
      }

      const { result: fetchedItems } = getResultIsArray(context)

      const idField = getIdField(context)

      if (!fetchedItems.length) {
        return
      }

      const ids = fetchedItems.map((x) => x && x[idField])

      let params: Params | null = {
        query: {
          [idField]: { $in: ids },
        },
        paginate: false,
      }

      params = options.params ? await options.params(params, context) : params
      return params ?? {}
    }
  } else {
    if (
      options.type === 'after' &&
      !options.params &&
      !context.params.query?.$select
    ) {
      return
    }

    const { stash: _stash, ...rest } = context.params
    const { $select, ...query } = context.params.query ?? {}

    const base: Params = { ...rest, query }
    const params = options.deleteParams?.length
      ? _omit(base, options.deleteParams)
      : base

    return (
      (typeof options.params === 'function'
        ? await options.params(params, context)
        : params) ?? {}
    )
  }
}

export type GetOrFindByIdOptions<H extends HookContext = HookContext> =
  GetOrFindByIdParamsOptions<H> & {
    byId?: boolean
  }

const getOrFindById = async <H extends HookContext, T>(
  context: H,
  _options: GetOrFindByIdOptions<H>,
): Promise<Record<Id, T> | T[] | undefined> => {
  const options = {
    byId: true,
    ..._options,
  }

  let itemOrItems
  const idField = getIdField(context)

  const params = await getOrFindByIdParams(context, options)

  if (context.id == null) {
    const method = options.skipHooks ? '_find' : 'find'

    itemOrItems = await context.service[method]({ ...params, _stash: true })

    itemOrItems = itemOrItems && (itemOrItems.data || itemOrItems)
  } else {
    const method = options.skipHooks ? '_get' : 'get'

    itemOrItems = await context.service[method](context.id, {
      ...params,
      _stash: true,
    })
  }

  const items = !itemOrItems
    ? []
    : Array.isArray(itemOrItems)
      ? itemOrItems
      : [itemOrItems]

  if (options.byId) {
    return items.reduce((byId, item) => {
      const id = item[idField]
      byId[id] = item
      return byId
    }, {})
  } else {
    return items
  }
}

const resultById = async <H extends HookContext>(
  context: H,
  options: GetOrFindByIdParamsOptions<H>,
): Promise<Record<string, unknown>> => {
  if (!context.result) {
    return {}
  }

  let items: Record<string, unknown>[]
  let params: Params | null | undefined = await getOrFindByIdParams(
    context,
    options,
  )

  if (params) {
    // mirror how `getOrFindByIdParams` builds the (re)fetch params (minus the
    // `$select` stripping) so an unchanged request skips the refetch
    const { stash: _stash, ...rest } = context.params
    const base: Params = { ...rest, query: context.params.query ?? {} }
    const contextParams = options.deleteParams?.length
      ? _omit(base, options.deleteParams)
      : base

    if (deepEqual(params, contextParams)) {
      params = null
    }
  }

  if (context.method === 'remove' || !params) {
    let itemOrItems = context.result
    itemOrItems = Array.isArray(itemOrItems.data)
      ? itemOrItems.data
      : itemOrItems
    items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems]
  } else {
    items = (await getOrFindById(context, {
      skipHooks: options?.skipHooks ?? false,
      byId: false,
      params: () => params,
      type: options.type,
    })) as Record<string, unknown>[]
  }

  const idField = context.service.id

  return items.reduce(
    (
      byId: Record<Id, Record<string, unknown>>,
      item: Record<string, unknown>,
    ) => {
      const id = item[idField] as Id
      byId[id] = item
      return byId
    },
    {},
  )
}

const getIdField = (context: Pick<HookContext, 'service'>): string => {
  return context.service.options.id
}

const getPath = (
  path: string | string[],
  isBefore: boolean,
): string | string[] => {
  if (isBefore) {
    if (typeof path === 'string') {
      return `params.${path}.itemsBefore`
    } else {
      return ['params', ...path, 'itemsBefore']
    }
  } else {
    if (typeof path === 'string') {
      return `params.${path}`
    } else {
      return ['params', ...path]
    }
  }
}
