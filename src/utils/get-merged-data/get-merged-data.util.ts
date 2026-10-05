import type { HookContext, Id } from '@feathersjs/feathers'
import {
  findAllOf,
  hasAllOwnProperties,
  pathsOverlap,
  pickPaths,
  toArray,
  topLevelKeys,
} from '../../common/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'
import { checkContext } from '../check-context/check-context.util.js'
import { getIdField } from '../get-id-field/get-id-field.util.js'
import {
  fetchShared,
  getCallFetches,
  paramsBefore,
} from '../define-stash/call-fetches.js'

export type MergedData<T = any> = {
  /**
   * The id of the item. `undefined` on `create`, where the item has none yet.
   */
  id: Id | undefined
  /**
   * The requested fields, with the values the item has once the call is
   * done: from `data` where it has them, otherwise as stored. A field neither
   * has is left out, and a nested one (`'address.city'`) is nested here the
   * same way.
   */
  data: Partial<T>
  /**
   * The requested fields as they are stored - only if they were fetched, so
   * not on `create`, `update` and a `patch` whose data has all of them.
   * Compare it with `data` to tell whether the call changes them.
   */
  stored?: Partial<T>
}

/**
 * Returns the given fields of every item a `create`, `update` or `patch` call
 * writes, with the values the item has once the call is done. They come from
 * `data` where it has them, otherwise from the database. One entry per item,
 * also for a multi `create` or `patch`.
 *
 * - `create` and `update`: from `data` alone, since it holds the whole item.
 * - `patch` with an id: from `data` if it has all the fields, otherwise the
 *   stored item is fetched and `data` merged over it.
 * - `patch` without an id: the stored items are always fetched, since only
 *   the fetch tells which items the call affects.
 *
 * Fields may be nested paths like `'address.city'`. `data` is merged over the
 * stored item the way a patch is: a property of `data` replaces the stored
 * one as a whole, so `{ address: { street } }` leaves no `address.city`.
 *
 * When it fetched, each entry also holds the fields as they are `stored`, to
 * tell whether the call changes them.
 *
 * The fetch only selects the id and the top-level properties of the fields.
 * It is shared with {@link defineStash}: a fetch of the call that has all of
 * them is reused - one of `stash` or `trigger`, which fetch whole items, or of
 * another `getMergedData`. So register `stash` or `trigger` first to fetch
 * only once. Use it in a `before` hook, or in an `around` hook before
 * `next()`.
 *
 * @example
 * ```ts
 * import { getMergedData } from 'feathers-utils/utils'
 *
 * app.service('users').hooks({
 *   before: {
 *     patch: [
 *       async (context) => {
 *         // `data` may only hold `firstName` - `lastName` comes from the database
 *         for (const { data } of await getMergedData<User>(context, ['firstName', 'lastName'])) {
 *           if (`${data.firstName} ${data.lastName}`.length > 100) {
 *             throw new BadRequest('name too long')
 *           }
 *         }
 *       },
 *     ],
 *   },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-merged-data.html
 */
export async function getMergedData<
  T = any,
  H extends HookContext = HookContext,
>(context: H, fields: MaybeArray<FieldKey<T>>): Promise<MergedData<T>[]> {
  checkContext(context, {
    type: ['before', 'around'],
    method: ['create', 'update', 'patch'],
    label: 'getMergedData',
  })

  // `context.type` stays 'around' after `next()`, the result tells
  if (context.result !== undefined) {
    throw new Error(
      "getMergedData: the adapter call already ran - use it in a before hook, or in an around hook before 'next()'",
    )
  }

  const paths: string[] = toArray(fields)

  if (context.method !== 'patch') {
    return toArray(context.data).map((data) => ({
      id: context.id ?? undefined,
      data: pickPaths(data, paths) as Partial<T>,
    }))
  }

  const data = context.data ?? {}
  assertMergeable(data, paths)

  // a property of `data` replaces the stored one as a whole
  const properties = topLevelKeys(paths)
  if (context.id != null && hasAllOwnProperties(data, properties)) {
    return [{ id: context.id, data: pickPaths(data, paths) as Partial<T> }]
  }

  // only the id and what the fields are part of - adapters like knex can't
  // select a nested path
  const idField = getIdField(context.service)
  const params = paramsBefore(context)
  const $select = properties.includes(idField)
    ? properties
    : [idField, ...properties]

  const items = await fetchShared(
    getCallFetches(context).before,
    { ...params, query: { ...params.query, $select } },
    (params) => findAllOf(context.service, params),
    idField,
  )

  return Array.from(items.values(), ({ id, item }) => ({
    id,
    data: pickPaths({ ...item, ...data }, paths) as Partial<T>,
    stored: pickPaths(item, paths) as Partial<T>,
  }))
}

/**
 * A patch data key like `'address.city'` is a nested path for mongodb, but a
 * plain key for the other adapters - which one it is decides the outcome, so
 * it can't be merged into a requested field it overlaps
 */
const assertMergeable = (data: Record<string, any>, paths: string[]) => {
  const key = Object.keys(data).find(
    (key) => key.includes('.') && paths.some((path) => pathsOverlap(key, path)),
  )

  if (key) {
    throw new Error(
      `getMergedData: can't tell the outcome of '${key}' in the patch data for the requested fields - a key with a dot is a nested path for some adapters only`,
    )
  }
}
