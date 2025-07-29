import type { HookContext } from '@feathersjs/feathers'

/**
 * Always returns the `context.data` as an array.
 * If `context.data` is not an array, it will be wrapped in an array.
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
