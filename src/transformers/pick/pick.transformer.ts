import _pick from 'lodash/pick.js'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { TransformerFn } from '../../types.js'

/**
 * Picks the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, transformResult, pick } from 'feathers-utils/transformers'
 *
 * {
 *   before: {
 *     all: [transformData(pick('email'))],
 *   }
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/pick.html
 */
export const pick = (fieldNames: MaybeArray<string>): TransformerFn => {
  const fieldNamesArr = toArray(fieldNames)

  return (item: any) => {
    return _pick(item, fieldNamesArr)
  }
}
