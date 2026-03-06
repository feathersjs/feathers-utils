import _omit from 'lodash/omit.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'

/**
 * Omit the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, omit } from 'feathers-utils/transformers'
 *
 * transformData(item => omit(item, 'email'))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/omit.html
 */
export function omit<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<FieldKey<NoInfer<T>>>,
): T {
  return _omit(item, toArray(fieldNames)) as T
}
