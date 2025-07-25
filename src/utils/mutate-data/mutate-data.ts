import type { HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from '../get-data-is-array/get-data-is-array.js'
import { isPromise } from '../../common/index.js'
import type { Promisable } from '../../internal.utils.js'
import type { TransformerFn } from '../../types.js'

export function mutateData<H extends HookContext = HookContext>(
  context: H,
  transformer: TransformerFn<any, H>,
): Promisable<H> {
  if (!context.data) {
    return context
  }

  const { data, isArray } = getDataIsArray(context)

  if (!data.length) {
    return context
  }

  let hasPromises = false

  const results = data.map((item) => {
    const result = transformer(item, context)

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
