import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.js'
import { isPromise } from '../../common/index.js'
import copy from 'fast-copy'
import type { DispatchOption, TransformerFn } from '../../types.js'

export type MutateResultOptions = {
  next?: NextFunction
  transform?: (items: any[]) => any[]
  dispatch?: DispatchOption
}

export async function mutateResult<H extends HookContext = HookContext>(
  context: H,
  transformer: TransformerFn<any, H>,
  options?: MutateResultOptions,
): Promise<H> {
  if (options?.next) {
    await options.next()
  }

  if (!!options?.dispatch && !context.dispatch) {
    context.dispatch = copy(context.result)
  }

  async function forResult(dispatch: boolean) {
    const { result, isArray, key } = getResultIsArray(context, { dispatch })

    if (!result.length) {
      return context
    }

    let hasPromises = false

    const results = result.map((item) => {
      const result = transformer(item, context)

      if (isPromise(result)) {
        hasPromises = true
        return result.then((res: any) => res ?? item)
      }

      return result ?? item
    })

    function mutate(r: any) {
      if (options?.transform) {
        r = options.transform(r)
      }

      if (!isArray) {
        context[key] = r[0]
      } else if (isArray && !Array.isArray(context[key]) && context[key].data) {
        context[key].data = r
      } else {
        context[key] = r
      }

      return context
    }

    if (hasPromises) {
      return await Promise.all(results).then(mutate)
    } else {
      return mutate(results)
    }
  }

  if (options?.dispatch === 'both') {
    await Promise.all([forResult(true), forResult(false)])
    return context
  }

  return await forResult(options?.dispatch ?? false)
}
