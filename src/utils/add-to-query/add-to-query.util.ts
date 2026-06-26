import type { Query } from '@feathersjs/feathers'
import { dequal as deepEqual } from 'dequal'

/**
 * Safely merges properties into a Feathers query object. If a property already exists
 * with a different value, it wraps both in a `$and` array to preserve both conditions.
 * If the exact same key-value pair already exists, no changes are made. When the added
 * query is itself a pure `$and` (`{ $and: [...] }`), its branches are flattened into the
 * target's `$and` rather than nested.
 *
 * @example
 * ```ts
 * import { addToQuery } from 'feathers-utils/utils'
 *
 * const query = { status: 'active' }
 * addToQuery(query, { role: 'admin' })
 * // => { status: 'active', role: 'admin' }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/add-to-query.html
 */
export function addToQuery<Q extends Query>(targetQuery: Q, query: Q): Q {
  targetQuery ??= {} as Q

  if (Object.keys(query).length === 0) {
    return targetQuery
  }

  const entries = Object.entries(query) as [keyof Q, any][]

  if (entries.every(([property]) => !(property in targetQuery))) {
    // if none of the properties exist, merge them directly
    return {
      ...targetQuery,
      ...query,
    }
  }

  function isAlreadyInQuery(targetQuery: Q, entries: [keyof Q, any][]) {
    return entries.every(
      ([property, value]) =>
        property in targetQuery && deepEqual(targetQuery[property], value),
    )
  }

  if (isAlreadyInQuery(targetQuery, entries)) {
    // if all properties already exist with the exact same value, do nothing
    return targetQuery
  }

  // when the added query is itself a pure `$and`, flatten its branches into the
  // target's `$and` instead of nesting another `$and` inside it
  if (entries.length === 1 && Array.isArray(query.$and)) {
    const existing = (targetQuery.$and as any[]) ?? []
    const newBranches = (query.$and as any[]).filter(
      (branch) => !existing.some((q) => deepEqual(q, branch)),
    )
    if (newBranches.length === 0) {
      return targetQuery
    }
    return {
      ...targetQuery,
      $and: [...existing, ...newBranches],
    }
  }

  if (!targetQuery.$and) {
    return {
      ...targetQuery,
      $and: [{ ...query }],
    }
  }

  // check if the exact same value already exists in $and
  if (targetQuery.$and.some((q: any) => isAlreadyInQuery(q, entries))) {
    return targetQuery
  }

  return {
    ...targetQuery,
    $and: [...targetQuery.$and, { ...query }],
  }
}
