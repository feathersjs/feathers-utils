import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { isDeepEqual, pickPaths, toArray } from '../../common/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { fetchStored } from '../../utils/define-stash/call-fetches.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'

export type SkipUnchangedOptions = {
  /**
   * Fields that don't count as a change on their own, like a timestamp a
   * hook sets on every patch. They are written along when another field
   * changes.
   *
   * @example
   * ```ts
   * skipUnchanged({ ignore: ['updatedAt'] })
   * ```
   */
  ignore?: MaybeArray<string>
}

/**
 * Drops the fields of a `patch` that keep their stored value - for every
 * item of a multi patch - and skips the write completely if nothing changes:
 * then `context.result` gets the stored items, and no `patched` event is
 * sent. Saves writes and events when a client sends a whole form.
 *
 * It fetches the whole stored items, once per call - `stash`, `trigger` and
 * {@link getMergedData} of the call reuse the fetch. A key with a dot like
 * `'address.city'`, or one like `$inc`, is not a key of the stored item, so it
 * always counts as a change.
 *
 * Use it as a `before` or `around` hook, after the hooks that change `data`.
 *
 * @example
 * ```ts
 * import { skipUnchanged } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { patch: [setUpdatedAt, skipUnchanged({ ignore: 'updatedAt' })] },
 * })
 *
 * // nothing changes: no write, no `patched` event
 * await app.service('users').patch(1, { name: 'Anna' })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/skip-unchanged.html
 */
export function skipUnchanged<H extends HookContext = HookContext>(
  options?: SkipUnchangedOptions,
) {
  const ignore = new Set<string>(options?.ignore ? toArray(options.ignore) : [])

  const run = async (context: H) => {
    const data: Record<string, any> = context.data ?? {}
    const items = [...(await fetchStored(context)).values()]
    // nothing to compare with - the patch fails or patches nothing anyway
    if (!items.length) return

    const keys = Object.keys(data)
    const keep: string[] = []
    let changes = false
    for (const key of keys) {
      if (ignore.has(key)) {
        keep.push(key)
        continue
      }
      for (const { item } of items) {
        if (!isDeepEqual(item[key], data[key])) {
          keep.push(key)
          changes = true
          break
        }
      }
    }

    if (changes) {
      if (keep.length < keys.length) context.data = pickPaths(data, keep)
      return
    }

    // nothing changes: the stored items, as the patch would have returned them
    const $select = context.params.query?.$select
    const result = $select
      ? items.map(({ item }) =>
          pickPaths(item, [getIdField(context.service), ...toArray($select)]),
        )
      : items.map(({ item }) => item)

    context.result = context.id == null ? result : result[0]
    context.event = null
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'around'],
      method: 'patch',
      label: 'skipUnchanged',
    })

    await run(context)
    if (next) await next()
  }

  return hook
}
