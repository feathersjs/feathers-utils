import type { HookContext } from '@feathersjs/feathers'
import { copy } from 'fast-copy'

type GetResultIsArrayOptions = {
  dispatch?: boolean
}

/**
 * Normalizes `context.result` (or `context.dispatch`) into an array for uniform processing.
 * Handles paginated results by extracting the `data` array. Returns `{ result, isArray, key }`
 * where `key` indicates whether `'result'` or `'dispatch'` was used.
 *
 * @example
 * ```ts
 * import { getResultIsArray } from 'feathers-utils/utils'
 *
 * const { result, isArray } = getResultIsArray(context)
 * result.forEach(item => { /* process each item *\/ })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-result-is-array.html
 */
export function getResultIsArray<H extends HookContext = HookContext>(
  context: H,
  options?: GetResultIsArrayOptions,
): { isArray: boolean; result: any[]; key: 'dispatch' | 'result' } {
  const { dispatch = false } = options || {}

  const isDispatch: boolean = dispatch && context.dispatch !== undefined

  const result = dispatch
    ? isDispatch
      ? context.dispatch
      : copy(context.result)
    : context.result

  if (!result) {
    return {
      isArray: false,
      result: [],
      key: isDispatch ? 'dispatch' : 'result',
    }
  }

  const items = context.method === 'find' ? result.data || result : result

  const isArray = Array.isArray(items)

  return {
    isArray,
    result: isArray ? items : items ? [items] : [],
    key: isDispatch ? 'dispatch' : 'result',
  }
}
