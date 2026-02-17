import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateData } from '../../utils/mutate-data/mutate-data.util.js'
import type { TransformerFn } from '../../types.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'

/**
 * Transforms each item in `context.data` using the provided transformer function.
 * The transformer receives each item and can mutate it in place or return a new object.
 * Commonly used with built-in transformers like `lowercase`, `trim`, or `setNow`.
 *
 * @example
 * ```ts
 * import { transformData, lowercase } from 'feathers-utils/transformers'
 *
 * app.service('users').hooks({
 *   before: { create: [transformData(lowercase('email'))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/transform-data.html
 */
export const transformData =
  <
    H extends HookContext = HookContext,
    D extends DataSingleHookContext<H> = DataSingleHookContext<H>,
  >(
    transformer: TransformerFn<D, H>,
  ) =>
  async (context: H, next?: NextFunction) => {
    await mutateData(context, transformer)

    if (next) {
      return next()
    }

    return context
  }
