import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import { BadRequest } from '@feathersjs/errors'
import type { StringFieldKey } from '../../types.js'

/**
 * Transforms the specified fields of an item to lowercase.
 *
 * @example
 * ```ts
 * import { transformData, lowercase } from 'feathers-utils/transformers'
 *
 * transformData(item => lowercase(item, 'email'))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/lowercase.html
 */
export function lowercase<T extends Record<string, any>>(
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
      throw new BadRequest(`Expected string (lowercase '${fieldName}')`)
    }

    _set(item, fieldName, value.toLowerCase())
  }
}
