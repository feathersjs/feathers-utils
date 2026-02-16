import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateData } from '../../utils/mutate-data/mutate-data.util.js'
import type { TransformerFn } from '../../types.js'

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
  <T = Record<string, any>, H extends HookContext = HookContext>(
    transformer: TransformerFn<T, H>,
  ) =>
  async (context: H, next?: NextFunction) => {
    await mutateData(context, transformer)

    if (next) {
      return next()
    }

    return context
  }
