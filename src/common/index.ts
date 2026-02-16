/**
 * Type guard that checks if a value is a `Promise` instance.
 *
 * @example
 * ```ts
 * const result = maybeSyncFn()
 * if (isPromise(result)) {
 *   await result
 * }
 * ```
 */
export function isPromise(p: any): p is Promise<any> {
  return p instanceof Promise
}

export { traverse } from './traverse.js'
export { clone } from './clone.js'
