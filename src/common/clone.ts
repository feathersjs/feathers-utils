/**
 * Deep-clones an object using `JSON.parse(JSON.stringify(...))`.
 * Simple and fast for JSON-serializable data, but does not handle
 * `Date` objects, `undefined` values, functions, or circular references.
 *
 * @example
 * ```ts
 * const copy = clone({ name: 'Alice', nested: { value: 1 } })
 * ```
 */
export function clone(obj: any) {
  return JSON.parse(JSON.stringify(obj))
}
