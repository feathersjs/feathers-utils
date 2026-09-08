import { dequal as deepEqual } from 'dequal'
import { dedupeBranches, isPlainObject } from '../../common/index.js'

/**
 * Flattens the keys of a `$sort` object into dot notation, keeping the sort
 * directions untouched. Returns the original object if there was nothing to
 * flatten.
 *
 * `$sort` is deliberately kept in dot notation in *both* directions, because
 * that is the only form the Feathers adapters understand. Two keys that flatten
 * to the same path keep the last direction — `$sort` has no `$and` to fall back
 * on.
 *
 * @internal shared by `dotifyQuery` and `nestifyQuery`.
 */
export const dotifySortKeys = <T extends Record<string, any>>(sort: T): T => {
  let changed = false
  const result: Record<string, any> = {}

  const walk = (node: Record<string, any>, prefix: string) => {
    for (const key of Object.keys(node)) {
      const value = node[key]
      const path = prefix ? `${prefix}.${key}` : key

      if (isPlainObject(value) && Object.keys(value).length > 0) {
        changed = true
        walk(value, path)
      } else {
        result[path] = value
      }
    }
  }

  walk(sort, '')

  return changed ? (result as T) : sort
}

/**
 * Builds a nested object along `segments`, innermost value last —
 * `nest(['a', 'b'], 1)` is `{ a: { b: 1 } }`.
 *
 * @internal shared by `dotifyQuery` and `nestifyQuery`.
 */
export const nest = (segments: string[], value: any): Record<string, any> => {
  let result = value
  for (let i = segments.length - 1; i >= 0; i--) {
    result = { [segments[i]]: result }
  }
  return result
}

/**
 * Assigns `value` to `key` on `target` without losing information:
 * - the key is free → plain assignment
 * - the existing value is deep-equal → nothing to do
 * - both sides are objects with disjoint keys → merged
 *
 * Anything else is a genuine conflict, which is returned as a `{ [key]: value }`
 * condition for the caller to add to `$and`.
 *
 * @internal shared by `dotifyQuery` and `nestifyQuery`.
 */
export const assignPath = (
  target: Record<string, any>,
  key: string,
  value: any,
): Record<string, any> | undefined => {
  if (!(key in target)) {
    target[key] = value
    return undefined
  }

  const existing = target[key]

  if (deepEqual(existing, value)) {
    return undefined
  }

  if (
    isPlainObject(existing) &&
    isPlainObject(value) &&
    Object.keys(value).every((subKey) => !(subKey in existing))
  ) {
    target[key] = { ...existing, ...value }
    return undefined
  }

  return { [key]: value }
}

/**
 * Merges conflicting conditions into `target.$and`, de-duplicating against the
 * branches that are already there.
 *
 * @internal shared by `dotifyQuery` and `nestifyQuery`.
 */
export const mergeAndBranches = (
  target: Record<string, any>,
  branches: Record<string, any>[],
): void => {
  const existing = Array.isArray(target.$and) ? target.$and : []
  target.$and = dedupeBranches([...existing, ...branches])
}

export type SetNestedResult = {
  /**
   * `false` when a segment was blocked by a non-object value, so the dotted key
   * was kept instead of being nested.
   */
  split: boolean
  /** A leaf condition that could not be set, for the caller to add to `$and`. */
  conflict?: Record<string, any>
}

/**
 * Sets `value` at the nested location described by `segments`, creating missing
 * levels and cloning existing ones so the input query is never mutated.
 *
 * When a segment is blocked by a non-object value there is no need to force the
 * nested shape: the dotted key is already a valid condition on its own, so it is
 * kept as-is and `split: false` is reported. Only a conflicting *leaf* has no
 * such fallback and comes back as a `conflict` for `$and`.
 *
 * @internal used by `nestifyQuery`.
 */
export const setNested = (
  target: Record<string, any>,
  segments: string[],
  value: any,
): SetNestedResult => {
  let node = target

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]

    if (!(segment in node)) {
      node[segment] = {}
    } else if (isPlainObject(node[segment])) {
      // clone, so a nested object coming from the input is never mutated
      node[segment] = { ...node[segment] }
    } else {
      // blocked — leave the condition where it is, in dot notation
      return {
        split: false,
        conflict: assignPath(target, segments.join('.'), value),
      }
    }

    node = node[segment]
  }

  return {
    split: true,
    conflict: assignPath(node, segments[segments.length - 1], value)
      ? nest(segments, value)
      : undefined,
  }
}
