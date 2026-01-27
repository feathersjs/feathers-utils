import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import { BadRequest } from '@feathersjs/errors'
import type { TransformerFn } from '../../types.js'

/**
 * Transforms the specified fields of an item to lowercase.
 *
 * @example
 * ```ts
 * import { transformData, transformResult, lowercase } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     all: [transformData(lowercase('email'))],
 *   }
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/lowercase.html
 */
export const lowercase = (fieldNames: MaybeArray<string>): TransformerFn => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
      const fieldName = fieldNamesArr[i]
      const value = _get(item, fieldName)

      if (value == null) {
        continue
      }

      if (typeof value !== 'string') {
        throw new BadRequest(`Expected string (lowercase '${fieldName}')`)
      }

      _set(item, fieldName, value.toLowerCase())
    }
  }
}
