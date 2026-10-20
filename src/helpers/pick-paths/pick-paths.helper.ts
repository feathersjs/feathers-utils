import type { PropertyPath } from '../../types.js'
import { castPath } from '../../common/to-path.js'
import { isUnsafeKey, setPathInPlace } from '../set-path/set-path.helper.js'

/** Marks a path that does not resolve, so `undefined` stays a pickable value. */
const MISSING = Symbol('missing')

/**
 * The value at `keys`, or `MISSING` when a segment is absent — inherited
 * properties count (`in`), as in `_.pick`.
 */
const resolve = (object: unknown, keys: readonly PropertyKey[]): unknown => {
  let current: any = object
  for (const key of keys) {
    if (current == null || !(key in Object(current))) return MISSING
    current = current[key]
  }
  return keys.length > 0 ? current : MISSING
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

  const source = Object(object)

  for (const path of paths) {
    // fast path: a string without `.` or `[` is always one key, so it skips
    // `castPath` and its array (picking flat fields is the common case)
    let key: PropertyKey | undefined
    let keys: readonly PropertyKey[] | undefined
    if (
      typeof path === 'string' &&
      path.indexOf('.') === -1 &&
      path.indexOf('[') === -1
    ) {
      key = path
    } else {
      keys = castPath(path, object)
      if (keys.length === 1) key = keys[0]
    }

    if (key !== undefined) {
      if (key in source && !isUnsafeKey(key)) result[key] = source[key]
      continue
    }

    const value = resolve(object, keys!)
    if (value !== MISSING) {
      setPathInPlace(result, keys as PropertyPath, value)
    }
  }

  return result as Partial<T>
}
