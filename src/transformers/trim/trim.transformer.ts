import { BadRequest } from '@feathersjs/errors'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { StringFieldKey } from '../../types.js'

/**
 * Trims the specified fields of an item.
 *
 * @example
 * ```ts
 * import { transformData, trim } from 'feathers-utils/transformers'
 *
 * transformData(item => trim(item, 'password'))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/trim.html
 */
export function trim<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<StringFieldKey<NoInfer<T>>>,
): void {
  const fieldNamesArr = toArray(fieldNames)

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
