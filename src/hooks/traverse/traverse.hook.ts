import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { traverse as _traverse } from '../../common/index.js'

export type TraverseOptions = {
  transformer: (transformContext: any) => any
  getObject: (
    context: HookContext,
  ) => Record<string, any> | Record<string, any>[]
}

/**
 * Recursively walks and transforms fields in record(s) using `neotraverse`.
 * The `getObject` function extracts the target from the context, and `transformer`
 * is called for every node during traversal --- ideal for deep, structural transformations.
 *
 * @example
 * ```ts
 * import { traverse } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   after: {
 *     all: [traverse({ getObject: (ctx) => ctx.result, transformer: function () { if (this.key === 'password') this.remove() } })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/traverse.html
 */
export const traverse =
  <H extends HookContext = HookContext>({
    transformer,
    getObject,
  }: TraverseOptions) =>
  (context: H, next?: NextFunction) => {
    _traverse(getObject(context), transformer)

    if (next) {
      return next()
    }

    return context
  }
