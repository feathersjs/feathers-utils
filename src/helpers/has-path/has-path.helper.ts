import type { PropertyPath } from '../../types.js'
import { castPath, reIsIndex } from '../../common/to-path.js'

/**
 * Whether `path` resolves to an **own** property — inherited properties do not
 * count, so a key named `toString` is only reported when the object really
 * carries it. A property that exists but holds `undefined` counts.
 *
 * @example
 * ```ts
 * import { hasPath } from 'feathers-utils/helpers'
 *
 * hasPath({ user: { id: 1 } }, 'user.id') // => true
 * hasPath({ user: { id: undefined } }, 'user.id') // => true
 * hasPath({ list: [1] }, 'list[1]') // => false
 * hasPath({}, 'toString') // => false
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/has-path.html
 */
export const hasPath = (object: unknown, path: PropertyPath): boolean => {
  const keys = castPath(path, object)
  let current: any = object
  let index = -1
  let result = false
  let key: PropertyKey = ''

  while (++index < keys.length) {
    key = keys[index]
    result = current != null && Object.hasOwn(Object(current), key)
    if (!result) break
    current = current[key]
  }

  if (result || index + 1 !== keys.length) return result

  // A trailing index into an array is "present" even when the slot is a hole.
  const length = current == null ? 0 : current.length
  return (
    !!length &&
    typeof length === 'number' &&
    Array.isArray(current) &&
    typeof key === 'string' &&
    reIsIndex.test(key) &&
    Number(key) < length
  )
}
