/**
 * Normalizes a value or array into an array. The returned array MUST be treated
 * as read-only — when the input is already an array it is returned as-is (no
 * copy) to avoid a per-call allocation on hook hot paths.
 *
 * @example
 * ```ts
 * import { toArray } from 'feathers-utils/helpers'
 *
 * toArray(1) // => [1]
 * toArray([1, 2]) // => [1, 2] (same reference)
 *
 * // single or multi
 * for (const item of toArray(context.data)) { ... }
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/to-array.html
 */
export const toArray = <T>(value: T | readonly T[]): T[] =>
  Array.isArray(value) ? (value as T[]) : [value as T]
