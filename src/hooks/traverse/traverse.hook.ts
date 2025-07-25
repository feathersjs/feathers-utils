import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { traverse as _traverse } from '../../common/index.js'

export type TraverseOptions = {
  transformer: (transformContext: any) => any
  getObject: (
    context: HookContext,
  ) => Record<string, any> | Record<string, any>[]
}

/**
 * Transform fields & objects in place in the record(s) using a recursive walk. Powerful.
 * Check docs at https://github.com/substack/js-traverse for info on transformContext!
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
