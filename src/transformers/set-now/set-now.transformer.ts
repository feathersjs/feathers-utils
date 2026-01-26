import _set from 'lodash/set.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { TransformerFn } from '../../types.js'

/**
 * Sets the specified fields of an item to the current date and time.
 *
 * @example
 * ```ts
 * import { transformData, transformResult, transformQuery, setNow } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     create: [transformData(setNow(['createdAt', 'updatedAt']))],
 *     update: [transformData(setNow('updatedAt'))],
 *     patch: [transformData(setNow('updatedAt'))],
 *   }
 * }
 * ```
 */
export const setNow = (fieldNames: MaybeArray<string>): TransformerFn => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    const now = new Date()

    for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
      const fieldName = fieldNamesArr[i]
      _set(item, fieldName, now)
    }
  }
}
