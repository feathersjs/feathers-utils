import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import type { DefaultsInput } from '../../types.js'

/**
 * Sets default values on an item for fields that are `undefined`.
 * Values can be static or functions that return a value.
 * Supports dot.notation for nested fields.
 *
 * @example
 * ```ts
 * import { transformData, defaults } from 'feathers-utils/transformers'
 *
 * transformData(item => defaults(item, { role: 'user', createdAt: () => new Date() }))
 * ```
 *
 * @see https://utils.feathersjs.com/transformers/defaults.html
 */
export function defaults<T extends Record<string, any>>(
  item: T,
  defaultValues: DefaultsInput<NoInfer<T>>,
): void {
  const entries = Object.entries(defaultValues)

  for (let i = 0, len = entries.length; i < len; i++) {
    const [key, value] = entries[i]

    if (_get(item, key) === undefined) {
      _set(item, key, typeof value === 'function' ? value() : value)
    }
  }
}
