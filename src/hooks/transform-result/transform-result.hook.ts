import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateResult } from '../../utils/mutate-result/mutate-result.util.js'
import type {
  DispatchOption,
  HookFunction,
  TransformerInputFn,
} from '../../types.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'
import type { AnyFallback } from '../../internal.utils.js'

type Result<H extends HookContext> = AnyFallback<
  ResultSingleHookContext<H>,
  Record<string, any>
>

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
 *   after: { all: [transformResult(item => omit(item, 'password'))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/transform-result.html
 */
export const transformResult =
  <H extends HookContext = HookContext>(
    transformer: TransformerInputFn<Result<H>, H>,
    options?: TransformResultOptions,
  ): HookFunction<H> =>
  (context: H, next?: NextFunction) =>
    mutateResult(context, transformer, {
      next,
      dispatch: options?.dispatch,
    }) as Promise<H>
