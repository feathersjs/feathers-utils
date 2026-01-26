import { BadRequest } from '@feathersjs/errors'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { TransformerFn } from '../../types.js'

/**
 * Trims the specified fields of an item.
 *
 * @example
 * ```ts
 * import { transformData, transformResult, trim } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     all: [transformData(trim('password'))],
 *   }
 * }
 * ```
 */
export const trim = (fieldNames: MaybeArray<string>): TransformerFn => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
      const fieldName = fieldNamesArr[i]
      const value = _get(item, fieldName)

      if (value == null) {
        continue
      }

      if (typeof value !== 'string') {
        throw new BadRequest(`Expected string (trim '${fieldName}')`)
      }

      _set(item, fieldName, value.trim())
    }
  }
}
