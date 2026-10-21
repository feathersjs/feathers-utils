/**
 * Type guard for a plain object — one whose prototype is `Object.prototype` or
 * `null`. Arrays, `null`, primitives and class instances (`Date`, `RegExp`,
 * `Map`, bson `ObjectId`, ...) are all `false`.
 *
 * @example
 * ```ts
 * import { isPlainObject } from 'feathers-utils/helpers'
 *
 * isPlainObject({}) // => true
 * isPlainObject(Object.create(null)) // => true
 * isPlainObject([]) // => false
 * isPlainObject(new Date()) // => false
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/is-plain-object.html
 */
export const isPlainObject = (value: unknown): value is Record<string, any> => {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
