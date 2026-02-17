import type { HookContext } from '@feathersjs/feathers'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'

export type GetDataIsArrayReturn<H extends HookContext = HookContext> = {
  isArray: boolean
  data: DataSingleHookContext<H>[]
}

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
): GetDataIsArrayReturn<H> {
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
