import type { Query } from '@feathersjs/feathers'
import { deepEqual } from 'fast-equals'

/**
 * Safely adds a property to a query object. If the property already exists, it adds it to the `$and` array.
 * If the exact same property-value pair already exists, it does nothing.
 */
export const addToQuery = <Q extends Query>(
  targetQuery: Q,
  property: string,
  value: any,
) => {
  if (!(property in targetQuery)) {
    return {
      ...targetQuery,
      [property]: value,
    }
  }

  if (deepEqual(targetQuery[property], value)) {
    // if the exact same value already exists, do nothing
    return targetQuery
  }

  if (!targetQuery.$and) {
    return {
      ...targetQuery,
      $and: [{ [property]: value }],
    }
  }

  // check if the exact same value already exists in $and
  if (
    targetQuery.$and.some(
      (q: any) => property in q && deepEqual(q[property], value),
    )
  ) {
    return targetQuery
  }

  return {
    ...targetQuery,
    $and: [...targetQuery.$and, { [property]: value }],
  }
}
