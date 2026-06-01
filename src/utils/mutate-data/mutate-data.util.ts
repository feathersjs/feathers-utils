import type { HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from '../get-data-is-array/get-data-is-array.util.js'
import { replaceData } from '../replace-data/replace-data.util.js'
import { isPromise } from '../../common/index.js'
import type { Promisable } from '../../internal.utils.js'
import type { TransformerInputFn } from '../../types.js'

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
export function mutateData<H extends HookContext = HookContext>(
  context: H,
  transformer: TransformerInputFn<any, H>,
): Promisable<H> {
  if (!context.data) {
    return context
  }

  // single-item fast path: avoid allocating a wrapper array + a mapped array
  // for the common single create/update/patch case.
  if (!Array.isArray(context.data)) {
    const item = context.data
    const result = transformer(item, { context, i: 0 })

    if (isPromise(result)) {
      return result.then((res: any) => {
        context.data = res ?? item
        return context
      })
    }

    context.data = result ?? item
    return context
  }

  const { data } = getDataIsArray(context)

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
    // delegate the array writeback (single is handled by the fast path above)
    return replaceData(context, data)
  }

  if (hasPromises) {
    return Promise.all(results).then(mutate)
  } else {
    return mutate(results)
  }
}
