import type { HookContext } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

export type IsContextOptions<H extends HookContext = HookContext> = {
  path?: MaybeArray<H['path']>
  type?: MaybeArray<H['type']>
  method?: MaybeArray<H['method']>
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
export const isContext = <H extends HookContext = HookContext>(
  options: IsContextOptions<H>,
) => {
  const path = options.path != null ? toArray(options.path) : undefined
  const type = options.type != null ? toArray(options.type) : undefined
  const method = options.method != null ? toArray(options.method) : undefined

  return (context: any): boolean => {
    if (path && !path.some((x) => context.path.includes(x))) {
      return false
    }

    if (type && !type.some((x) => context.type === x)) {
      return false
    }

    if (method && !method.some((x) => context.method === x)) {
      return false
    }

    return true
  }
}
