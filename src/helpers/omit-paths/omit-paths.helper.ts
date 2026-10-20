import type { PropertyPath } from '../../types.js'
import { castPath } from '../../common/to-path.js'
import { shallowClone } from '../../common/shallow-clone.js'
import { setOwnProperty } from '../../common/set-own-property.js'

/**
 * Returns a copy of `object` without the given paths. Paths may be nested
 * (`'user.email'`), in which case the objects on the way are copied so the
 * source keeps its key; untouched branches stay shared by reference. Arrays and
 * class instances on the path are copied too — nothing here writes into what it
 * was handed.
 *
 * Each entry of `paths` is one path, and a segment array is one nested path —
 * the same reading as in `getPath`/`hasPath`/`setPath`.
 *
 * @example
 * ```ts
 * import { omitPaths } from 'feathers-utils/helpers'
 *
 * omitPaths({ id: 1, user: { email: 'a@b.c', name: 'a' } }, ['user.email'])
 * // => { id: 1, user: { name: 'a' } }
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/omit-paths.html
 */
export const omitPaths = <T extends Record<PropertyKey, any>>(
  object: T | null | undefined,
  paths: readonly PropertyPath[],
): Partial<T> => {
  const result: Record<PropertyKey, any> = {}
  if (object == null) return result as Partial<T>

  // own AND inherited enumerable keys, plus own enumerable symbols
  for (const key in object) setOwnProperty(result, key, object[key])
  for (const sym of Object.getOwnPropertySymbols(object)) {
    if (Object.prototype.propertyIsEnumerable.call(object, sym)) {
      result[sym] = object[sym]
    }
  }

  // the containers copied so far, so paths sharing a prefix copy it only once
  let copies: Set<object> | undefined

  for (const path of paths) {
    const keys = castPath(path, object)
    let parent: any = result

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const child = Object.hasOwn(parent, key) ? parent[key] : undefined
      if (child === null || typeof child !== 'object') {
        parent = undefined
        break
      }
      if (!copies?.has(child)) {
        const copy = shallowClone(child)
        ;(copies ??= new Set()).add(copy)
        setOwnProperty(parent, key, copy)
        parent = copy
      } else {
        parent = child
      }
    }

    if (parent !== undefined) delete parent[keys[keys.length - 1]]
  }

  return result as Partial<T>
}
