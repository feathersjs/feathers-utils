import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateResult } from '../../utils/mutate-result/mutate-result.util.js'
import type { DispatchOption, TransformerFn } from '../../types.js'

export type TransformResultOptions = {
  dispatch?: DispatchOption
}

/**
 * Make changes to items in `context.result`. Very flexible.
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
