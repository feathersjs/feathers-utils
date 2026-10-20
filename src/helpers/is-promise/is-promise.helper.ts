/**
 * Type guard that checks if a value is a native `Promise` instance. A thenable
 * that is not a `Promise` is `false`.
 *
 * @example
 * ```ts
 * import { isPromise } from 'feathers-utils/helpers'
 *
 * const result = maybeAsync()
 * if (isPromise(result)) {
 *   await result
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/helpers/is-promise.html
 */
export function isPromise(p: any): p is Promise<any> {
  return p instanceof Promise
}
