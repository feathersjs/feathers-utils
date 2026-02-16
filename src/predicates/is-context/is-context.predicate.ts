import type { HookType } from '@feathersjs/feathers'
import type { MethodName } from '../../types.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

export type IsContextOptions = {
  path?: MaybeArray<string>
  type?: MaybeArray<HookType>
  method?: MaybeArray<MethodName>
}

/**
 * Returns a predicate that checks whether the hook context matches the given criteria.
 * You can filter by `path` (service name), `type` (before/after/around/error),
 * and/or `method` (find/get/create/update/patch/remove).
 *
 * @example
 * ```ts
 * import { iff, isContext } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(isContext({ method: 'create', type: 'before' }), validateHook())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/is-context.html
 */
export const isContext =
  (options: IsContextOptions) =>
  (context: any): boolean => {
    if (options.path != null) {
      const path = toArray(options.path)

      if (!path.some((x) => context.path.includes(x))) {
        return false
      }
    }

    if (options.type != null) {
      const type = toArray(options.type)

      if (!type.some((x) => context.type === x)) {
        return false
      }
    }

    if (options.method != null) {
      const method = toArray(options.method)

      if (!method.some((x) => context.method === x)) {
        return false
      }
    }

    return true
  }
