import type { HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from '../get-data-is-array/get-data-is-array.util.js'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import { checkContext } from '../check-context/check-context.util.js'
import type {
  DataSingleHookContext,
  ResultSingleHookContext,
} from '../../utility-types/hook-context.js'

export type ZipDataResultOptions = {
  onMismatch?: (context: HookContext) => void
}

export type ZipDataResultItem<D, R> = {
  data: D | undefined
  result: R | undefined
}

/**
 * Pairs each item in `context.data` with its corresponding item in `context.result` by index.
 * Handles both single-item and array data, normalizing them into an array of `{ data, result }` pairs.
 * Only works in `after`/`around` hooks for `create`, `update`, and `patch` methods.
 *
 * @example
 * ```ts
 * import { zipDataResult } from 'feathers-utils/utils'
 *
 * const pairs = zipDataResult(context)
 * pairs.forEach(({ data, result }) => { /* process each pair *\/ })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/zip-data-result.html
 */
export function zipDataResult<
  H extends HookContext,
  D extends DataSingleHookContext<H> = DataSingleHookContext<H>,
  R extends ResultSingleHookContext<H> = ResultSingleHookContext<H>,
>(context: H, options?: ZipDataResultOptions): ZipDataResultItem<D, R>[] {
  checkContext(context, ['after', 'around'], ['create', 'update', 'patch'])

  const input = getDataIsArray(context)
  const output = getResultIsArray(context)

  if (
    input.isArray &&
    output.isArray &&
    input.data.length !== output.result.length
  ) {
    options?.onMismatch?.(context)
  }

  const result: ZipDataResultItem<D, R>[] = []

  const length = Math.max(input.data.length, output.result.length)

  for (let i = 0; i < length; i++) {
    const dataItem = input.isArray ? input.data.at(i) : input.data[0]
    const resultItem = output.result.at(i)

    result.push({
      data: dataItem,
      result: resultItem,
    })
  }

  return result
}
