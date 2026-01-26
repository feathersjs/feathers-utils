import type { Query } from '@feathersjs/feathers'
import { dequal as deepEqual } from 'dequal'

/**
 * Safely adds a property to a query object. If the property already exists, it adds it to the `$and` array.
 * If the exact same property-value pair already exists, it does nothing.
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
