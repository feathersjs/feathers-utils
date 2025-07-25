import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { mutateData } from '../../utils/mutate-data/mutate-data.js'
import type { TransformerFn } from '../../types.js'

/**
 * Make changes to items in `context.data`. Very flexible.
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
