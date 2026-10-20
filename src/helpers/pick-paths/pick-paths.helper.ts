import type { PropertyPath } from '../../types.js'
import { castPath } from '../../common/to-path.js'
import { getPath } from '../get-path/get-path.helper.js'
import { setPathInPlace } from '../set-path/set-path.helper.js'

/** Whether `path` resolves at all, inherited properties included (`in`). */
const hasIn = (object: unknown, keys: readonly PropertyKey[]): boolean => {
  let current: any = object
  for (const key of keys) {
    if (current == null || !(key in Object(current))) return false
    current = current[key]
  }
  return keys.length > 0
}

/**
 * Returns an object holding only the given paths of `object`. Paths may be
 * nested (`'user.email'`), in which case the result is nested the same way.
 * Paths that do not resolve are skipped; the source is never written to.
 *
 * Each entry of `paths` is one path, and a segment array is one nested path —
 * the same reading as in `getPath`/`hasPath`/`setPath`.
 *
 * @example
 * ```ts
 * import { pickPaths } from 'feathers-utils/helpers'
 *
 * pickPaths({ id: 1, user: { email: 'a@b.c', name: 'a' } }, ['id', 'user.email'])
 * // => { id: 1, user: { email: 'a@b.c' } }
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/pick-paths.html
 */
export const pickPaths = <T extends Record<PropertyKey, any>>(
  object: T | null | undefined,
  paths: readonly PropertyPath[],
): Partial<T> => {
  const result: Record<PropertyKey, any> = {}
  if (object == null) return result as Partial<T>

  for (const path of paths) {
    const keys = castPath(path, object)
    if (hasIn(object, keys)) {
      setPathInPlace(result, keys as PropertyPath, getPath(object, keys))
    }
  }

  return result as Partial<T>
}
