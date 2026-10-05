import type { FeathersError } from '@feathersjs/errors'
import { BadRequest } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { transformData } from '../transform-data/transform-data.hook.js'
import type { KeyOfOrDotNotation, MaybeArray } from '../../internal.utils.js'
import {
  getPath,
  hasOwnProperty,
  hasPath,
  isDeepEqual,
  omitPaths,
  pathsOverlap,
  setPath,
  toArray,
  topLevelKey,
  topLevelKeys,
} from '../../common/index.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { fetchStored } from '../../utils/define-stash/call-fetches.js'

export type PreventChangesOptions<D, Keys extends KeyOfOrDotNotation<D>> = {
  /**
   * Throw instead of dropping the change - a `BadRequest`, or the error the
   * function returns.
   */
  error?: boolean | ((item: D, name: Keys) => FeathersError)
  /**
   * Whether a `patch` counts a field as a change only if its value differs
   * from the stored one - so data that sends a field with its stored value
   * passes, as a form does. Without it, every protected field in `data` is a
   * change. An `update` always compares, since its data holds the whole item.
   *
   * @default false
   */
  compare?: boolean
  /**
   * Whether the fetch of the stored items, for `update` and `compare`,
   * selects only the protected fields. With `false`, it fetches the whole
   * items - which `stash`, `trigger` and the other hooks of the call reuse.
   *
   * @default true
   */
  select?: boolean
}

/**
 * Prevents calls from changing certain fields, nested ones in dot.notation
 * included. By default the change is dropped; with `error`, the call fails.
 *
 * - `patch`: a protected field in `data` is removed from it - or, with
 *   `compare`, only if its value differs from the stored one. A nested one
 *   then gets its stored value back, since its parent replaces the stored
 *   one as a whole.
 * - `update`: a protected field whose value differs from the stored one gets
 *   the stored value back, since removing it would delete it.
 *
 * @example
 * ```ts
 * import { preventChanges } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: {
 *     patch: [preventChanges(['email', 'role'], { error: true })],
 *     update: [preventChanges(['email', 'role'], { error: true })],
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/prevent-changes.html
 */
export const preventChanges = <
  H extends HookContext = HookContext,
  D extends DataSingleHookContext<H> = DataSingleHookContext<H>,
  Keys extends KeyOfOrDotNotation<D> = KeyOfOrDotNotation<D>,
>(
  fieldNames: MaybeArray<Keys>,
  options?: PreventChangesOptions<D, Keys>,
) => {
  const fields = toArray(fieldNames) as Keys[]
  const properties = topLevelKeys(fields as string[])

  const failed = (item: unknown, name: Keys, verb: string) =>
    typeof options?.error === 'function'
      ? options.error(item as D, name)
      : new BadRequest(
          `Field ${String(name)} may not be ${verb}. (preventChanges)`,
        )

  /** a protected field in `data` is a change */
  const byPresence = transformData<H>((item) => {
    if (options?.error) {
      for (let i = 0; i < fields.length; i++) {
        if (hasPath(item, fields[i]!)) throw failed(item, fields[i]!, 'patched')
      }
      return item
    }
    return omitPaths(item, fields)
  })

  const storedItems = (context: H) =>
    fetchStored(context, options?.select === false ? undefined : properties)

  /** a protected field gets its stored value back */
  const onUpdate = async (context: H) => {
    const [stored] = (await storedItems(context)).values()
    if (!stored) return

    const data = context.data
    let restored: Record<string, any> | undefined
    for (const field of fields) {
      const value = getPath(stored.item, field)
      if (isDeepEqual(getPath(data, field), value)) continue
      if (options?.error) throw failed(data, field, 'changed')

      restored ??= { ...data }
      restored =
        value === undefined
          ? omitPaths(restored, [field])
          : setPath(restored, field, value)
    }

    if (restored) context.data = restored
  }

  /** a protected field whose value differs for one of the items is a change */
  const onPatch = async (context: H) => {
    const data = context.data ?? {}

    // keys to drop from `data`, and nested fields to give their stored value
    const drop = new Set<string>()
    const restore = new Set<Keys>()

    // a key with a dot is a path for some adapters only - it can't be compared
    for (const key of Object.keys(data)) {
      if (
        key.includes('.') &&
        fields.some((field) => pathsOverlap(key, field))
      ) {
        if (options?.error) throw failed(data, key as Keys, 'changed')
        drop.add(key)
      }
    }

    const present = fields.filter((field) =>
      hasOwnProperty(data, topLevelKey(field)),
    )
    if (!present.length) {
      if (drop.size) context.data = omitPaths(data, [...drop])
      return
    }

    const items = [...(await storedItems(context)).values()]
    for (const { item } of items) {
      // `data` replaces the top-level properties it has as a whole
      const merged = { ...item, ...data }
      for (const field of present) {
        if (restore.has(field) || drop.has(field)) continue
        if (isDeepEqual(getPath(merged, field), getPath(item, field))) continue
        if (options?.error) throw failed(data, field, 'changed')

        // dropping a nested field would leave its parent without it
        if (field.includes('.')) restore.add(field)
        else drop.add(field)
      }
    }

    let next: Record<string, any> = data
    for (const field of restore) {
      const value = getPath(items[0]!.item, field)
      if (items.every(({ item }) => isDeepEqual(getPath(item, field), value))) {
        next = next === data ? { ...data } : next
        next =
          value === undefined
            ? omitPaths(next, [field])
            : setPath(next, field, value)
      } else {
        // a single `data` can't give the items their different values
        drop.add(topLevelKey(field))
      }
    }

    if (drop.size) next = omitPaths(next, [...drop])
    if (next !== data) context.data = next
  }

  return async (context: H, next?: NextFunction) => {
    if (
      context.method !== 'update' &&
      !(context.method === 'patch' && options?.compare)
    ) {
      return await byPresence(context, next)
    }

    checkContext(context, {
      type: ['before', 'around'],
      label: 'preventChanges',
    })

    if (context.method === 'update') await onUpdate(context)
    else await onPatch(context)

    if (next) await next()
  }
}
