import type { PropertyPath } from '../../types.js'
import { castPath, reIsIndex } from '../../common/to-path.js'
import { shallowClone } from '../../common/shallow-clone.js'

/** Keys that would let a path write reach `Object.prototype`. */
const isUnsafeKey = (key: PropertyKey) =>
  key === '__proto__' || key === 'constructor' || key === 'prototype'

const write = <T>(
  target: T,
  path: PropertyPath,
  value: unknown,
  copyOnWrite: boolean,
): T => {
  if (target === null || typeof target !== 'object') return target

  const keys = castPath(path, target)
  let nested: any = target

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (isUnsafeKey(key)) return target
    if (nested === null || typeof nested !== 'object') return target

    if (i === keys.length - 1) {
      nested[key] = value
      break
    }

    const current = nested[key]
    if (current !== null && typeof current === 'object') {
      if (copyOnWrite) nested[key] = shallowClone(current)
    } else {
      const nextKey = keys[i + 1]
      nested[key] =
        typeof nextKey === 'string' && reIsIndex.test(nextKey) ? [] : {}
    }
    nested = nested[key]
  }

  return target
}

/**
 * Writes `value` at `path`, copying every object on the way — the copy-on-write
 * that leaves a caller's `params` untouched.
 *
 * `target` itself IS mutated (a hook owns `context` and re-assigns
 * `context.params`); everything below it is replaced by a shallow copy, so
 * untouched branches keep their identity. That matters for values Feathers
 * compares by reference, such as `params.connection`, which a deep clone would
 * break.
 *
 * Missing segments are created as an array when the next key is an integer
 * index, otherwise as a plain object. Paths through `__proto__`, `constructor`
 * or `prototype` are ignored.
 *
 * @example
 * ```ts
 * import { setPath } from 'feathers-utils/helpers'
 *
 * // in a hook: params.query is copied, params.connection keeps its identity
 * setPath(context, 'params.query.userId', context.params.user.id)
 *
 * setPath({}, 'a[0].b', 1) // => { a: [{ b: 1 }] }
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/set-path.html
 */
export const setPath = <T>(target: T, path: PropertyPath, value: unknown): T =>
  write(target, path, value, true)

/**
 * Writes `value` at `path`, mutating every object on the way. Use it only on a
 * value you own — a freshly built item or one a transformer was handed to
 * change; for anything reachable from a caller's `params`, use {@link setPath}.
 *
 * @example
 * ```ts
 * setPathInPlace(item, 'createdAt', new Date())
 * ```
 */
export const setPathInPlace = <T>(
  target: T,
  path: PropertyPath,
  value: unknown,
): T => write(target, path, value, false)
