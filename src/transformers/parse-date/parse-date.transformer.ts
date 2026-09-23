import { BadRequest } from '@feathersjs/errors'
import { getPath, setPathInPlace, toArray } from '../../common/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'

/**
 * Parses the specified fields of an item into Date objects.
 *
 * @example
 * ```ts
 * import { transformData, parseDate } from 'feathers-utils/transformers'
 *
 * transformData(item => parseDate(item, ['startDate', 'endDate']))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/parse-date.html
 */
export function parseDate<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<FieldKey<NoInfer<T>>>,
): void {
  const fieldNamesArr = toArray(fieldNames)

  for (let i = 0, len = fieldNamesArr.length; i < len; i++) {
    const key = fieldNamesArr[i]
    const value = getPath(item, key)
    if (value) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) {
        throw new BadRequest(`Expected valid date (parseDate '${key}')`)
      }
      setPathInPlace(item, key, date)
    }
  }
}
