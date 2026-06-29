import type { HookContext } from '@feathersjs/feathers'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'

/**
 * Replaces `context.data` wholesale with the given items, preserving the original
 * single-vs-array shape. This is the explicit inverse of `getDataIsArray`: get the
 * data as an array, modify or replace the items, then write them back.
 *
 * @example
 * ```ts
 * import { getDataIsArray, replaceData } from 'feathers-utils/utils'
 *
 * const { data } = getDataIsArray(context)
 * const next = data.map((item) => ({ ...item, slug: slugify(item.name) }))
 * replaceData(context, next)
 * ```
 *
 * @see https://utils.feathersjs.com/utils/replace-data.html
 */
export function replaceData<H extends HookContext = HookContext>(
  context: H,
  data: DataSingleHookContext<H>[],
): H {
  context.data = Array.isArray(context.data) ? data : data[0]
  return context
}
