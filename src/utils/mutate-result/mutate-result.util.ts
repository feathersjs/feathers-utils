import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import { isPromise } from '../../common/index.js'
import { copy } from 'fast-copy'
import type { DispatchOption, TransformerFn } from '../../types.js'
import type { ResultSingleHookContext } from '../../utility-types/index.js'

export type MutateResultOptions = {
  next?: NextFunction
  transform?: (items: any[]) => any[]
  dispatch?: DispatchOption
}

/**
 * Applies a transformer function to each item in `context.result` (and optionally `context.dispatch`).
 * Handles paginated results, single items, and arrays transparently.
 * Use the `dispatch` option to control whether result, dispatch, or both are transformed.
 *
 * @example
 * ```ts
 * import { mutateResult } from 'feathers-utils/utils'
 *
 * await mutateResult(context, (item) => { delete item.password })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/mutate-result.html
 */
export async function mutateResult<
  H extends HookContext = HookContext,
  R extends ResultSingleHookContext<H> = ResultSingleHookContext<H>,
>(
  context: H,
  transformer: TransformerFn<R, H>,
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

    const results = result.map((item, i) => {
      const result = transformer(item, { context, i })

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
