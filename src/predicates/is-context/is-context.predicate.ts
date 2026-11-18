import type { HookContext } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'
import { maybeArrayMatches } from '../../common/index.js'

export type IsContextOptions<H extends HookContext = HookContext> = {
  /**
   * The service path(s) to match, as registered with `app.use()`.
   */
  path?: MaybeArray<H['path']>
  /**
   * The hook type(s) to match: `'before'`, `'after'`, `'around'` or `'error'`.
   */
  type?: MaybeArray<H['type']>
  /**
   * The service method(s) to match, including custom methods.
   */
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
  const { path, type, method, id } = options

  return (context: any): boolean =>
    (path == null || maybeArrayMatches(path, context.path)) &&
    (type == null || maybeArrayMatches(type, context.type)) &&
    (method == null || maybeArrayMatches(method, context.method)) &&
    // `null` is a valid id to match (the multi variants), so only `undefined`
    // can mean "not given" here
    (id === undefined || maybeArrayMatches(id, context.id))
}
