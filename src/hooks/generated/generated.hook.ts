import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { toSingleParams } from '../../common/change-many.js'
import {
  changesTopLevel,
  hasAllOwnProperties,
  isUnchanged,
  omitPaths,
  pickPaths,
  toArray,
  topLevelKey,
} from '../../common/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import { getDataIsArray } from '../../utils/get-data-is-array/get-data-is-array.util.js'
import { getMergedData } from '../../utils/get-merged-data/get-merged-data.util.js'
import { getResultIsArray } from '../../utils/get-result-is-array/get-result-is-array.util.js'
import { patchBatch } from '../../utils/patch-batch/patch-batch.util.js'
import type { PatchBatchResultItem } from '../../utils/patch-batch/patch-batch.util.js'
import { replaceData } from '../../utils/replace-data/replace-data.util.js'
import { replaceResult } from '../../utils/replace-result/replace-result.util.js'

export type GeneratedOptions<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
> = {
  /**
   * The fields `generate` returns, as top-level properties. Only `generate`
   * sets them: a value the caller sends for one is overwritten with the
   * computed one, or dropped if `generate` leaves the field out.
   */
  fields: MaybeArray<keyof NoInfer<T> & string>
  /**
   * The fields the generated ones are computed from, nested paths like
   * `'address.city'` included. A `patch` that changes none of them leaves the
   * generated fields as they are.
   */
  from: MaybeArray<FieldKey<NoInfer<T>>>
  /**
   * Computes the generated fields of all items of the call at once - with a
   * single call for a multi `create` of 100 items, too. Gets the `from` fields
   * of each item, with the values it has once the call is done, and returns
   * the generated fields of each, in the same order.
   *
   * @example
   * ```ts
   * generate: async (users, context) =>
   *   users.map(({ firstName, lastName }) => ({
   *     fullName: `${firstName} ${lastName}`,
   *   })),
   * ```
   */
  generate: (
    items: Partial<NoInfer<T>>[],
    context: H,
  ) => Promisable<Partial<NoInfer<T>>[]>
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
 * Keeps fields that are computed from other fields of the same item up to
 * date, like a generated column. On `create` and `update` they are computed
 * from `data`. A `patch` recomputes them only if it changes one of the `from`
 * fields; those it lacks are read from the database with
 * {@link getMergedData}.
 *
 * Register it as an `around` hook, or as a `before` and an `after` hook. Put
 * it after the hooks that change `data`, so it computes from the final data.
 * The part after the call is only needed when a multi `patch` makes the
 * generated fields differ per item, which a single `data` can't express -
 * then it writes them after the call, with one write per group of items with
 * equal values, and puts them into `context.result`.
 *
 * @example
 * ```ts
 * import { generated } from 'feathers-utils/hooks'
 *
 * const names = generated<UsersContext>({
 *   fields: ['fullName', 'initials'],
 *   from: ['firstName', 'lastName'],
 *   generate: async (users) =>
 *     users.map(({ firstName, lastName }) => ({
 *       fullName: `${firstName} ${lastName}`,
 *       initials: `${firstName?.[0]}${lastName?.[0]}`,
 *     })),
 * })
 *
 * app.service('users').hooks({
 *   around: {
 *     // after the hooks that validate or resolve `data`
 *     create: [validate, names],
 *     update: [validate, names],
 *     patch: [validate, names],
 *   },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/generated.html
 */
export function generated<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
>(options: GeneratedOptions<H, T>) {
  const fields: string[] = toArray(options.fields)
  const from: string[] = toArray(options.from)
  // the properties of `data` that decide the `from` fields
  const fromProperties = new Set(from.map(topLevelKey))

  const nested = fields.find((field) => field.includes('.'))
  if (nested) {
    // a patch replaces a top-level property as a whole, so writing
    // `address.label` would wipe the rest of `address`
    throw new Error(
      `generated: '${nested}' is nested - generated fields have to be top-level properties`,
    )
  }

  /** the values of a multi patch that differ per item, written after it */
  const pendingWrites = new WeakMap<HookContext, PatchBatchResultItem[]>()

  /** `item` without the generated fields, but with those of `values` */
  const withValues = (item: Record<string, any>, values: unknown) => ({
    ...omitPaths(item, fields),
    ...pickPaths(values as Record<string, any>, fields),
  })

  const generate = async (items: Partial<T>[], context: H) => {
    const values = await options.generate(items, context)
    if (!Array.isArray(values) || values.length !== items.length) {
      throw new Error(
        `generated: generate returned ${Array.isArray(values) ? values.length : 'no'} values for ${items.length} items - it has to return one per item, in the same order`,
      )
    }
    return values
  }

  const before = async (context: H) => {
    if (context.method !== 'patch') {
      const { data: items } = getDataIsArray(context)
      const values = await generate(
        items.map((item) => pickPaths(item, from) as Partial<T>),
        context,
      )
      replaceData(
        context,
        items.map((item, i) => withValues(item, values[i]) as typeof item),
      )
      return
    }

    const data = context.data ?? {}

    if (!changesTopLevel(data, fromProperties)) {
      context.data = withValues(data, {})
      return
    }

    // `data` decides all `from` fields - the same values for every item
    if (hasAllOwnProperties(data, fromProperties)) {
      const [values] = await generate(
        [pickPaths(data, from) as Partial<T>],
        context,
      )
      context.data = withValues(data, values)
      return
    }

    const items = await getMergedData<T>(context, from as FieldKey<T>[], {
      select: options.select,
    })

    // the stored generated fields still hold, if no `from` field changes -
    // with one that does, all are computed, so they can share a write
    if (items.every(({ data, stored }) => isUnchanged(data, stored))) {
      context.data = withValues(data, {})
      return
    }

    const values = await generate(
      items.map((item) => item.data),
      context,
    )

    // items with equal values share a write
    const idField = getIdField(context.service)
    const batches = patchBatch(
      items.map((item, i) => ({
        ...withValues({}, values[i]),
        [idField]: item.id,
      })),
      { id: idField },
    )

    // equal for every item - the call writes them itself
    if (batches.length <= 1) {
      context.data = withValues(data, values[0])
      return
    }

    if (typeof context.service._patch !== 'function') {
      throw new Error(
        "generated: the generated fields differ per item of the multi patch, so they are written after it - which needs the '_patch' method of a database adapter",
      )
    }

    context.data = withValues(data, {})
    pendingWrites.set(context, batches)
  }

  const after = async (context: H) => {
    const writes = pendingWrites.get(context)
    if (!writes) return
    pendingWrites.delete(context)

    // the query selected the items - applied again, it may no longer match
    const params = toSingleParams(context.params)
    const results = await Promise.all(
      writes.map(([id, values, batchParams]) =>
        context.service._patch(
          id,
          values,
          batchParams
            ? { ...params, query: { ...params.query, ...batchParams.query } }
            : params,
        ),
      ),
    )
    // a write of a group returns an array, one of a single item the item
    const written: Record<string, any>[] = results.flat()

    const idField = getIdField(context.service)
    const byId = new Map<string, Record<string, any>>()
    for (const item of written) byId.set(String(item[idField]), item)
    const { result } = getResultIsArray(context)
    replaceResult(
      context,
      result.map(
        (item) => (byId.get(String(item[idField])) ?? item) as typeof item,
      ),
    )
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'after', 'around'],
      method: ['create', 'update', 'patch'],
      label: 'generated',
    })

    if (context.type === 'before') return await before(context)
    if (context.type === 'after') return await after(context)

    await before(context)
    if (next) await next()
    await after(context)
  }

  return hook
}
