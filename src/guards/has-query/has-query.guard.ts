import type { Params } from '@feathersjs/feathers'
import type { RequiredQuery } from '../../utility-types/required-query.js'

/**
 * Type guard to check if the `query` property of `Params` is present and non-nullable.
 *
 * @param params - The `Params` object to check.
 * @returns `true` if `params.query` is present and non-nullable, otherwise `false`.
 *
 * @see https://utils.feathersjs.com/guards/has-query.html
 *
 * @example
 * ```ts
 * import { hasQuery } from 'feathers-utils/guards'
 *
 * function example(params: Params) {
 *   // `params.query` is optional and can be undefined at this point
 *   if (!hasQuery(params)) {
 *     return;
 *   }
 *
 *   // TypeScript now knows that params.query is present and non-nullable
 *   // You can safely access params.query here without additional checks
 * }
 * ```
 */
export function hasQuery<P extends Params>(
  params: P,
): params is RequiredQuery<P> {
  return !!params.query
}
