import _omit from 'lodash/omit.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

/**
 * Omit the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, transformResult } from 'feathers-utils/hooks'
 * import { omit } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     all: [transformData(omit('email'))],
 *   }
 * }
 * ```
 */
export const omit = (fieldNames: MaybeArray<string>) => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    return _omit(item, fieldNamesArr)
  }
}
