import type { Params } from '@feathersjs/feathers'
import type { TransformParamsFn } from '../../types.js'

/**
 * Safely applies a `transformParams` function to a params object.
 * If no function is provided, the original params are returned unchanged.
 * The function receives a shallow copy of params, so the original is not mutated.
 *
 * @example
 * ```ts
 * import { transformParams } from 'feathers-utils/utils'
 *
 * const params = transformParams(context.params, (p) => { delete p.provider; return p })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/transform-params.html
 */
export const transformParams = <P extends Params = Params>(
  params: P,
  fn: TransformParamsFn<P> | undefined,
): P => {
  if (!fn) {
    return params
  }

  const result = fn({ ...params })

  return result ?? params
}
