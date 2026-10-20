import { hasSymbolKeys } from '../../common/has-symbol-keys.js'
import { isPlainObject } from '../is-plain-object/is-plain-object.helper.js'

/**
 * Returns `true` only for a plain object without keys (`{}`). Arrays, `null`,
 * `undefined`, primitives, class instances (a `Date` has no own keys either)
 * and non-empty objects are all `false` - an object with only symbol keys
 * (sequelize's operators) included.
 *
 * @example
 * ```ts
 * import { isEmptyObject } from 'feathers-utils/helpers'
 *
 * isEmptyObject({}) // => true
 * isEmptyObject({ a: 1 }) // => false
 * isEmptyObject({ [Op.or]: [] }) // => false
 * isEmptyObject([]) // => false
 * isEmptyObject(undefined) // => false
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/is-empty-object.html
 */
export const isEmptyObject = (obj: unknown): boolean =>
  isPlainObject(obj) && Object.keys(obj).length === 0 && !hasSymbolKeys(obj)
