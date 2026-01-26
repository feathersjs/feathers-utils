import { toArray, type MaybeArray } from '../../internal.utils.js'
import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { TransformerFn } from '../../types.js'

/**
 * Parses the specified fields of an item into Date objects.
 *
 * @example
 * ```ts
 * import { transformData, transformResult, transformQuery, parseDate } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     create: [transformData(parseDate(['startDate', 'endDate']))],
 *     update: [transformData(parseDate(['startDate', 'endDate']))],
 *     patch: [transformData(parseDate(['startDate', 'endDate']))],
 *   }
 * }
 * ```
 */
export const parseDate = (fieldNames: MaybeArray<string>): TransformerFn => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
      const key = fieldNamesArr[i]
      const value = _get(item, key)
      if (value) {
        _set(item, key, new Date(value))
      }
    }
  }
}
