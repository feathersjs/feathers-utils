import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateResult } from '../../utils/mutate-result/mutate-result.util.js'
import type { DispatchOption, TransformerFn } from '../../types.js'

export type TransformResultOptions = {
  dispatch?: DispatchOption
}

/**
 * Transforms each item in `context.result` using the provided transformer function.
 * The transformer receives each item and can mutate it in place or return a new object.
 * Optionally operates on `context.dispatch` via the `dispatch` option.
 *
 * @example
 * ```ts
 * import { transformResult, omit } from 'feathers-utils/transformers'
 *
 * app.service('users').hooks({
 *   after: { all: [transformResult(omit('password'))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/transform-result.html
 */
export const transformResult =
  <T = Record<string, any>, H extends HookContext = HookContext>(
    transformer: TransformerFn<T, H>,
    options?: TransformResultOptions,
  ) =>
  (context: H, next?: NextFunction) =>
    mutateResult(context, transformer, {
      next,
      dispatch: options?.dispatch,
    })
