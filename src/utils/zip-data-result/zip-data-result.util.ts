import type { HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from '../get-data-is-array/get-data-is-array.util.js'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import { checkContext } from '../check-context/check-context.util.js'
import type {
  DataSingleHookContext,
  ResultSingleHookContext,
} from '../../utility-types/hook-context.js'

export type ZipDataResultOptions = {
  /**
   * Called if `context.data` and `context.result` are arrays of different
   * lengths.
   */
  onMismatch?: (context: HookContext) => void
  /**
   * How the items of `context.data` and `context.result` are paired: by their
   * position, or by the id of the data item - a data item without an id by
   * its position, if no other data item took that result by its id. Ids are
   * compared as strings, so bson `ObjectId`s match as well. The pairs are in
   * the order of `context.data`, followed by the results no data item got.
   *
   * @default 'index'
   *
   * @example
   * ```ts
   * // on a multi create with ids in the data, whatever order the result has
   * const pairs = zipDataResult(context, { by: 'id' })
   * ```
   */
  by?: 'index' | 'id'
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

  if (options?.by === 'id' && input.isArray) {
    return zipById(context, input.data as D[], output.result as R[])
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

const zipById = <D, R>(
  context: HookContext,
  data: D[],
  results: R[],
): ZipDataResultItem<D, R>[] => {
  const idField: string = context.service?.id ?? 'id'
  const idOf = (item: any): unknown => item?.[idField]

  const indexOfId = new Map<string, number>()
  results.forEach((result, i) => {
    const id = idOf(result)
    if (id != null && !indexOfId.has(String(id))) indexOfId.set(String(id), i)
  })

  const taken = new Set<number>()
  const take = (i: number | undefined) => {
    if (i === undefined || i >= results.length || taken.has(i)) return
    taken.add(i)
    return i
  }

  // the data items with an id first, so one without can't take their result
  const indexes = data.map((item) => {
    const id = idOf(item)
    return id != null ? (take(indexOfId.get(String(id))) ?? -1) : undefined
  })
  data.forEach((_, i) => {
    indexes[i] ??= take(i) ?? -1
  })

  const pairs: ZipDataResultItem<D, R>[] = data.map((item, i) => {
    const index = indexes[i] as number
    return { data: item, result: index >= 0 ? results[index] : undefined }
  })

  results.forEach((result, i) => {
    if (!taken.has(i)) pairs.push({ data: undefined, result })
  })

  return pairs
}
