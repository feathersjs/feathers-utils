import _pick from 'lodash/pick.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

/**
 * Picks the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, transformResult } from 'feathers-utils/hooks'
 * import { pick } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     all: [transformData(pick('email'))],
 *   }
 * }
 * ```
 */
export const pick = (fieldNames: MaybeArray<string>) => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    return _pick(item, fieldNamesArr)
  }
}
