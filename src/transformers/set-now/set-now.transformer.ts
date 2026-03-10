import _set from 'lodash/set.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'

/**
 * Sets the specified fields of an item to the current date and time.
 *
 * @example
 * ```ts
 * import { transformData, setNow } from 'feathers-utils/transformers'
 *
 * transformData(item => setNow(item, ['createdAt', 'updatedAt']))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/set-now.html
 */
export function setNow<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<FieldKey<NoInfer<T>>>,
): void {
  const fieldNamesArr = toArray(fieldNames)
  const now = new Date()

  for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
    const fieldName = fieldNamesArr[i]
    _set(item, fieldName, now)
  }
}
