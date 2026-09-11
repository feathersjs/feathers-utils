import type { HookContext } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../common/index.js'

export type IsContextOptions<H extends HookContext = HookContext> = {
  path?: MaybeArray<H['path']>
  type?: MaybeArray<H['type']>
  method?: MaybeArray<H['method']>
  /**
   * The `id` of a `get`, `update`, `patch` or `remove` call. `null` matches the
   * multi variant of those, which is what Feathers puts there when several
   * records are addressed at once.
   *
   * Ids are compared strictly: `3` does not match `'3'`.
   */
  id?: MaybeArray<NonNullable<H['id']> | null>
}

/**
 * Returns a predicate that checks whether the hook context matches the given criteria.
 * You can filter by `path` (service name), `type` (before/after/around/error),
 * `method` (find/get/create/update/patch/remove) and/or `id` (the record a
 * `get`/`update`/`patch`/`remove` addresses, `null` for the multi variants).
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
 * @example
 * ```ts
 * // a single record, or every multi call
 * isContext({ method: 'patch', id: 1 })
 * isContext({ method: ['patch', 'remove'], id: null })
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
  // `null` is a valid id to match (the multi variants), so only `undefined`
  // can mean "not given" here
  const id = options.id !== undefined ? toArray(options.id) : undefined

  return (context: any): boolean => {
    if (path && !path.some((x) => context.path === x)) {
      return false
    }

    if (type && !type.some((x) => context.type === x)) {
      return false
    }

    if (method && !method.some((x) => context.method === x)) {
      return false
    }

    if (id && !id.some((x) => context.id === x)) {
      return false
    }

    return true
  }
}
