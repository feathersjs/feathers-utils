import type { MaybeArray } from '../../internal.utils.js'
import { omitPaths, toArray } from '../../common/index.js'
import type { FieldKey } from '../../types.js'

/**
 * Omit the specified fields from an item.
 *
 * @example
 * ```ts
 * import { transformData, omit } from 'feathers-utils/transformers'
 *
 * transformData(item => omit(item, 'email'))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/omit.html
 */
export function omit<T extends Record<string, any>>(
  item: T,
  fieldNames: MaybeArray<FieldKey<NoInfer<T>>>,
): T {
  return omitPaths(item, toArray(fieldNames)) as T
}
