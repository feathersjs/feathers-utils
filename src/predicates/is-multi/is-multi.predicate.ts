import type { HookContext } from '@feathersjs/feathers'

/**
 * Checks if the current hook context represents a multi operation.
 * Returns `true` for `find`, for `create` with array data, and for `patch`/`remove`
 * with `id === null`. Returns `false` for `get` and `update`.
 *
 * @example
 * ```ts
 * import { iff, isMulti } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(isMulti, rateLimitHook())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/is-multi.html
 */
export const isMulti = <H extends HookContext = HookContext>(
  context: H,
): boolean => {
  const { method } = context
  if (method === 'find') {
    return true
  } else if (method === 'patch' || method === 'remove') {
    return context.id == null
  } else if (method === 'create') {
    return Array.isArray(context.data)
  } else if (method === 'get' || method === 'update') {
    return false
  }

  return false
}
