import type { PropertyPath } from '../../types.js'
import { castPath } from '../../common/to-path.js'

/**
 * Reads the value at `path`, returning `defaultValue` when the path does not
 * resolve or resolves to `undefined`. Descending stops at `null`/`undefined`
 * instead of throwing.
 *
 * A path is a dot/bracket string (`'user.id'`, `'list[0].x'`) or an array of
 * segments (`['user', 'id']`).
 *
 * @example
 * ```ts
 * import { getPath } from 'feathers-utils/helpers'
 *
 * getPath({ user: { id: 1 } }, 'user.id') // => 1
 * getPath({ list: [{ x: 1 }] }, 'list[0].x') // => 1
 * getPath({ user: null }, 'user.id', 0) // => 0
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/get-path.html
 */
export const getPath = <T = any>(
  object: unknown,
  path: PropertyPath,
  defaultValue?: T,
): T => {
  if (object == null) return defaultValue as T

  const keys = castPath(path, object)
  let current: any = object
  let index = 0

  while (current != null && index < keys.length) {
    current = current[keys[index++]]
  }

  const result = index > 0 && index === keys.length ? current : undefined

  return (result === undefined ? defaultValue : result) as T
}
