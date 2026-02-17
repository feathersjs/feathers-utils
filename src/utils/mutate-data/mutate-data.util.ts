import type { HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from '../get-data-is-array/get-data-is-array.util.js'
import { isPromise } from '../../common/index.js'
import type { Promisable } from '../../internal.utils.js'
import type { TransformerFn } from '../../types.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'

/**
 * Applies a transformer function to each item in `context.data`, updating it in place.
 * If the transformer returns a new object, it replaces the original item.
 * Correctly handles both single-item and array data, preserving the original shape.
 *
 * @example
 * ```ts
 * import { mutateData } from 'feathers-utils/utils'
 *
 * await mutateData(context, (item) => { item.name = item.name.trim() })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/mutate-data.html
 */
export function mutateData<
  H extends HookContext = HookContext,
  Data extends DataSingleHookContext<H> = DataSingleHookContext<H>,
>(context: H, transformer: TransformerFn<Data, H>): Promisable<H> {
  if (!context.data) {
    return context
  }

  const { data, isArray } = getDataIsArray(context)

  if (!data.length) {
    return context
  }

  let hasPromises = false

  const results = data.map((item, i) => {
    const result = transformer(item, { context, i })

    if (isPromise(result)) {
      hasPromises = true
      return result.then((res: any) => res ?? item)
    }

    return result ?? item
  })

  function mutate(data: any) {
    context.data = isArray ? data : data[0]

    return context
  }

  if (hasPromises) {
    return Promise.all(results).then(mutate)
  } else {
    return mutate(results)
  }
}
