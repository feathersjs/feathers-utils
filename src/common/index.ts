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
export { isEmptyObject } from './is-empty-object.js'
export { dedupeBranches } from './dedupe-branches.js'
export { flattenAndBranches } from './flatten-and-branches.js'
export { flattenOrBranches } from './flatten-or-branches.js'
