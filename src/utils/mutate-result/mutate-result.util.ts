import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { getResultIsArray } from '../get-result-is-array/get-result-is-array.util.js'
import { isPromise } from '../../common/index.js'
import { copy } from 'fast-copy'
import type { Promisable } from '../../internal.utils.js'
import type { DispatchOption, TransformerInputFn } from '../../types.js'

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
export function mutateResult<H extends HookContext = HookContext>(
  context: H,
  transformer: TransformerInputFn<any, H>,
  options?: MutateResultOptions,
): Promisable<H> {
  if (!!options?.dispatch && !context.dispatch) {
    context.dispatch = copy(context.result)
  }

  function forResult(dispatch: boolean): Promisable<H> {
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
      return Promise.all(results).then(mutate)
    } else {
      return mutate(results)
    }
  }

  function run(): Promisable<H> {
    if (options?.dispatch === 'both') {
      const a = forResult(true)
      const b = forResult(false)

      if (isPromise(a) || isPromise(b)) {
        return Promise.all([a, b]).then(() => context)
      }

      return context
    }

    return forResult(options?.dispatch ?? false)
  }

  if (options?.next) {
    return options.next().then(run)
  }

  return run()
}
