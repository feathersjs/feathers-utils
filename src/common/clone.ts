import { copy } from 'fast-copy'

/**
 * Deep-clones a value using `fast-copy`.
 *
 * Unlike a `JSON.parse(JSON.stringify(...))` round-trip, this correctly handles
 * `Date`, `Map`, `Set`, `RegExp`, typed arrays, `undefined` values and circular
 * references — all of which FeathersJS payloads routinely contain.
 *
 * @example
 * ```ts
 * const copyOf = clone({ name: 'Alice', createdAt: new Date(), nested: { value: 1 } })
 * ```
 */
export const clone = copy
