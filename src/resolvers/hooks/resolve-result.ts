import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { resolve, type ResolverObject } from './resolvers.internal.js'
import { mutateResult } from '../../utils/index.js'

export const resolveResult = <
  T extends Record<string, any>,
  H extends HookContext = HookContext,
>(
  resolverProperties: ResolverObject<T, H>,
) => {
  return async (context: H, next?: NextFunction) => {
    if (next) {
      await next()
    }

    await mutateResult(context, (item) =>
      resolve(resolverProperties, item, context),
    )

    return context
  }
}
