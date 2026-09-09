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

export { allowsMulti } from './allows-multi.js'
export { changeMany } from './change-many.js'
export { traverse } from './traverse.js'
export { clone } from './clone.js'
export { hasOwnProperty } from './has-own-property.js'
export { toArray } from './to-array.js'
export { early } from './early.js'
export { isEmptyObject } from './is-empty-object.js'
export { isPlainObject } from './is-plain-object.js'
export { isOnlyOperator } from './is-only-operator.js'
export { singleProperty } from './single-property.js'
export { dedupeBranches } from './dedupe-branches.js'
export { dedupeValues } from './dedupe-values.js'
export { flattenAndBranches } from './flatten-and-branches.js'
export { flattenOrBranches } from './flatten-or-branches.js'
export { collapseOrBranches } from './collapse-or-branches.js'
export { collapseToEqOrNe } from './collapse-to-eq-or-ne.js'
export { extractQueryFilters } from './extract-query-filters.js'
export type { FilterQueryResult } from './extract-query-filters.js'
export { mergeSelect } from './merge-select.js'
export type { SelectMergeMode } from './merge-select.js'
export { branchOperators } from './query-operators.js'
