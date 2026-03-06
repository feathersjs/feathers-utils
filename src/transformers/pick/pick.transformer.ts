import _pick from 'lodash/pick.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'

/**
 * Picks the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, pick } from 'feathers-utils/transformers'
 *
 * transformData(item => pick(item, 'email'))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/pick.html
 */
export function pick<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<FieldKey<NoInfer<T>>>,
): Partial<T> {
  return _pick(item, toArray(fieldNames))
}
