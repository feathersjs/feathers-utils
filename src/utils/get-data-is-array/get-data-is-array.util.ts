import type { HookContext } from '@feathersjs/feathers'

/**
 * Normalizes `context.data` into an array for uniform processing.
 * Returns `{ data, isArray }` where `data` is always an array and `isArray` indicates
 * whether the original value was already an array.
 *
 * @example
 * ```ts
 * import { getDataIsArray } from 'feathers-utils/utils'
 *
 * const { data, isArray } = getDataIsArray(context)
 * data.forEach(item => { /* process each item *\/ })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-data-is-array.html
 */
export function getDataIsArray<H extends HookContext = HookContext>(
  context: H,
): { data: any[]; isArray: boolean } {
  if (!context.data) {
    return {
      isArray: false,
      data: [],
    }
  }

  const isArray = Array.isArray(context.data)

  return {
    isArray,
    data: isArray ? context.data : [context.data],
  }
}
