import { Conflict } from '@feathersjs/errors'
import type { FeathersError } from '@feathersjs/errors'
import type { HookContext, Id, NextFunction } from '@feathersjs/feathers'
import {
  changesTopLevel,
  findAllOf,
  getPath,
  isDeepEqual,
  isUnchanged,
  isPlainObject,
  pickPaths,
  toArray,
  topLevelKey,
  topLevelKeys,
} from '../../common/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import { eqOrIn } from '../../utils/eq-or-in/eq-or-in.util.js'
import { getMergedData } from '../../utils/get-merged-data/get-merged-data.util.js'
import { neOrNin } from '../../utils/ne-or-nin/ne-or-nin.util.js'

/** An item of a conflict: its id - none for one a `create` adds - and fields */
export type UniqueItem<T = any> = { id: Id | undefined; data: Partial<T> }

export type UniqueConflict<T = any> = {
  /**
   * The item of the call that conflicts, with its `fields` and those of
   * `where` - the values it has once the call is done
   */
  item: UniqueItem<T>
  /**
   * What it conflicts with: another item of the call, or a `stored` one with
   * its `fields`
   */
  existing: UniqueItem<T> & { stored: boolean }
}

export type UniqueOptions<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
> = {
  /**
   * The fields whose combination has to be unique, like the columns of a
   * unique index: two items conflict only if all of them are equal.
   */
  fields: MaybeArray<FieldKey<NoInfer<T>>>
  /**
   * Only items that match it count, like the `WHERE` of a partial index - an
   * item that doesn't is neither checked nor conflicts with others. Equality
   * per field only, `null` matching a field that is not set.
   *
   * @example
   * ```ts
   * // unique among the items that are not deleted
   * unique({ fields: 'email', where: { deletedAt: null } })
   * ```
   */
  where?: { [K in FieldKey<NoInfer<T>>]?: unknown }
  /**
   * Whether items conflict when a field is `null` or not set, as with
   * `NULLS NOT DISTINCT` in Postgres. By default such an item is not checked,
   * like `NULL` in a unique index.
   *
   * @default false
   */
  nullsNotDistinct?: boolean
  /**
   * The error to throw instead of the `Conflict`, e.g. to tell a form which
   * field is taken. The default leaves out the id of a stored item: it may be
   * one the caller must not know of.
   *
   * @example
   * ```ts
   * unique({
   *   fields: ['tenantId', 'email'],
   *   error: () =>
   *     new BadRequest('Invalid data', { errors: { email: 'is already taken' } }),
   * })
   * ```
   */
  error?: (conflict: UniqueConflict<T>, context: H) => FeathersError
  /**
   * Whether the stored items are queried with the `_find` of the adapter,
   * without the hooks of the service - since a unique index spans all items:
   * a hook that narrows `find`, to a tenant say, hides the conflicts outside
   * of it. With `false`, they are queried with `find`, through the hooks. A
   * service without `_find` is queried with `find` in any case.
   *
   * @default true
   */
  underscore?: boolean
  /**
   * Whether the fetch of the stored items selects only the fields it needs.
   * With `false`, it fetches the whole items - which `stash`, `trigger` and
   * the other hooks of the call reuse, so a chain that needs them later
   * fetches only once. See {@link getMergedData}.
   *
   * @default true
   */
  select?: boolean
}

/**
 * Checks that no two items share the values of `fields`, like a unique index:
 * among the items of the call, and against the stored items apart from those
 * the call changes. Throws a `Conflict` if they do.
 *
 * Reads the values the items have once the call is done with
 * {@link getMergedData}, so a `patch` of only some of the fields is checked
 * as well - and one that changes
 * neither the fields nor those of `where` is not checked at all. The stored
 * items are queried once per call, with the `_find` of the adapter: without
 * hooks, since a unique index spans all items - a hook that scopes `find`
 * would hide the conflicts.
 *
 * Use it as a `before` or `around` hook, after the hooks that change `data`.
 *
 * @example
 * ```ts
 * import { unique } from 'feathers-utils/hooks'
 *
 * // one email per tenant, among the users that are not deleted
 * const uniqueEmail = unique({
 *   fields: ['tenantId', 'email'],
 *   where: { deletedAt: null },
 * })
 *
 * app.service('users').hooks({
 *   before: { create: [uniqueEmail], update: [uniqueEmail], patch: [uniqueEmail] },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/unique.html
 */
export function unique<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
>(options: UniqueOptions<H, T>) {
  const fields: string[] = toArray(options.fields)
  const where: Record<string, unknown> = options.where ?? {}
  const whereFields = Object.keys(where)

  const operator = whereFields.find(
    (key) =>
      key.startsWith('$') ||
      (isPlainObject(where[key]) &&
        Object.keys(where[key]).some((k) => k.startsWith('$'))),
  )
  if (operator) {
    throw new Error(
      `unique: '${operator}' of where is an operator - where only compares for equality, since it is checked against the new items as well`,
    )
  }

  // the fields whose change may change the outcome
  const read = [...fields, ...whereFields]
  const readProperties = new Set(read.map(topLevelKey))
  const single = fields.length === 1

  /** whether the item is in the index */
  const inWhere = (data: Record<string, any>) => {
    for (const key of whereFields) {
      if (!isDeepEqual(getPath(data, key) ?? null, where[key] ?? null)) {
        return false
      }
    }
    return true
  }

  /** the values of `fields` - none if one is `null` and nulls are distinct */
  const valuesOf = (data: Record<string, any>) => {
    const values: unknown[] = []
    for (const field of fields) {
      const value = getPath(data, field) ?? null
      if (value === null && !options.nullsNotDistinct) return undefined
      values.push(value)
    }
    return values
  }

  /** the query condition an item with these values matches */
  const toCondition = (values: unknown[]) => {
    const condition: Record<string, unknown> = {}
    for (let i = 0; i < fields.length; i++) condition[fields[i]!] = values[i]
    return condition
  }

  /** what the stored items are queried for: their id, and the `fields` */
  const selectFields = topLevelKeys(fields)

  /** the key of the values of `fields`, to match items by */
  const keyOf = (values: unknown[]) => JSON.stringify(values)

  const conflict = (context: H, conflict: UniqueConflict<T>) =>
    options.error
      ? options.error(conflict, context)
      : new Conflict(
          fields.length === 1
            ? `'${fields[0]}' has to be unique`
            : `'${fields.join("', '")}' have to be unique together`,
          { fields },
        )

  const check = async (context: H) => {
    if (
      context.method === 'patch' &&
      !changesTopLevel(context.data ?? {}, readProperties)
    ) {
      return
    }

    const items = await getMergedData<T>(context, read as FieldKey<T>[], {
      select: options.select,
    })

    // one pass: the items the call changes, those of them in the index,
    // duplicates among them, and what to look for among the stored items - a
    // value, or a condition per item
    const changing: Id[] = []
    const lookFor: unknown[] = []
    const checked = new Map<string, UniqueItem<T>>()
    for (const { id, data, stored } of items) {
      // unchanged, it was checked when it got these values - and stays a
      // stored item the others are checked against
      if (isUnchanged(data, stored)) continue
      if (id !== undefined) changing.push(id)

      if (!inWhere(data)) continue

      const values = valuesOf(data)
      if (!values) continue

      const key = keyOf(values)
      const other = checked.get(key)
      if (other) {
        throw conflict(context, {
          item: { id, data },
          existing: { ...other, stored: false },
        })
      }
      checked.set(key, { id, data })

      lookFor.push(single ? values[0] : toCondition(values))
    }
    if (!lookFor.length) return

    // against the stored items, apart from those the call changes
    const idField = getIdField(context.service)
    const query = {
      ...where,
      ...(single ? { [fields[0]!]: eqOrIn(lookFor) } : { $or: lookFor }),
      ...(changing.length && { [idField]: neOrNin(changing) }),
      $select: selectFields.includes(idField)
        ? selectFields
        : [idField, ...selectFields],
      $limit: 1,
    }

    const { provider: _, ...params } = context.params
    const [existing] = await findAllOf(
      context.service,
      { ...params, query },
      {
        underscore:
          (options.underscore ?? true) &&
          typeof context.service._find === 'function',
      },
    )
    if (!existing) return

    // the item with the values of the stored one - or, if the database matched
    // them in a way the values don't show (say, case-insensitively), the first
    const item =
      checked.get(
        keyOf(fields.map((field) => getPath(existing, field) ?? null)),
      ) ?? checked.values().next().value!
    throw conflict(context, {
      item,
      existing: {
        id: existing[idField],
        data: pickPaths(existing, fields) as Partial<T>,
        stored: true,
      },
    })
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'around'],
      method: ['create', 'update', 'patch'],
      label: 'unique',
    })

    await check(context)
    if (next) await next()
  }

  return hook
}
