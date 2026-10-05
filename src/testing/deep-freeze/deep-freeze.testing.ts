import { ownEnumerableKeys } from '../../common/index.js'

/**
 * Freezes `value` and everything reachable through its own enumerable
 * properties - symbol keys included - in place, and returns it. Any write into
 * it then throws in strict mode, however deep, which makes it the quickest way
 * to prove that a hook leaves the `params` it is handed alone.
 *
 * Objects that are frozen already are walked as well, so a shallowly frozen
 * value ends up frozen all the way down. Self-references are fine.
 *
 * @example
 * ```ts
 * import { deepFreeze } from 'feathers-utils/testing'
 *
 * const params = deepFreeze({ query: { $limit: 10 } })
 *
 * params.query.$limit = 20 // TypeError: Cannot assign to read only property
 * ```
 *
 * @see https://utils.feathersjs.com/testing/deep-freeze.html
 */
export const deepFreeze = <T>(value: T): T => {
  freeze(value, new WeakSet())
  return value
}

const freeze = (value: unknown, visited: WeakSet<object>): void => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return
  }
  visited.add(value)

  // typed arrays - a `Buffer`, say - can't be frozen while they hold elements
  if (ArrayBuffer.isView(value)) return

  Object.freeze(value)
  for (const key of ownEnumerableKeys(value)) {
    freeze((value as any)[key], visited)
  }
}
