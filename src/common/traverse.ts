import _traverse from 'neotraverse'

/**
 * Recursively traverses items (or an array of items) and applies a converter function
 * to every node using `neotraverse`. Modifications happen in place.
 *
 * @example
 * ```ts
 * traverse(items, function () { if (this.key === 'secret') this.remove() })
 * ```
 */
export function traverse<T extends Record<string, any>>(
  items: T | T[],
  converter: (item: T) => void,
) {
  ;(Array.isArray(items) ? items : [items]).forEach((item) => {
    _traverse(item).forEach(converter) // replacement is in place
  })
}
