import type { Query } from '@feathersjs/feathers'

type WalkQueryOptionsInit = {
  property?: string
  operator?: string | undefined
  value?: any
  path: (string | number)[]
}

export type WalkQueryOptions = {
  property: string
  operator: string | undefined
  value: any
  path: (string | number)[]
}

export type WalkQueryCallback = (options: WalkQueryOptions) => any

const _walkQueryUtil = <Q extends Query>(
  query: Q,
  walker: WalkQueryCallback,
  options?: WalkQueryOptionsInit | WalkQueryOptions,
): Q => {
  let cloned = false
  const clonedSecond: Record<string, boolean> = {}
  function set(key: string, value: any, secondKey?: string | number) {
    if (!cloned) {
      query = { ...query }
      cloned = true
    }

    if (secondKey !== undefined) {
      if (!clonedSecond[key]) {
        ;(query as any)[key] = { ...query[key] }
        clonedSecond[key] = true
      }
      query[key][secondKey] = value
      return
    }

    ;(query as any)[key] = value
  }

  for (const key in query) {
    if (
      (key === '$or' || key === '$and' || key === '$nor' || key === '$not') &&
      Array.isArray(query[key])
    ) {
      let array = query[key]

      let copiedArray = false

      for (let i = 0, n = array.length; i < n; i++) {
        const nestedQuery = array[i]
        const transformed = _walkQueryUtil(nestedQuery, walker, {
          ...options,
          path: [...(options?.path || []), key, i],
        })

        if (transformed !== nestedQuery) {
          if (!copiedArray) {
            array = [...array] as any
            copiedArray = true
          }

          array[i] = transformed
        }
      }

      if (copiedArray) {
        set(key, array)
      }
    } else if (
      typeof query[key] === 'object' &&
      query[key] !== null &&
      !Array.isArray(query[key])
    ) {
      let hasOperator = false
      for (const operator in query[key]) {
        if (operator.startsWith('$')) {
          hasOperator = true
          const value = walker({
            operator,
            path: [...(options?.path ?? []), key],
            property: key,
            value: query[key][operator],
          })

          if (value !== undefined && value !== query[key][operator]) {
            set(key, value, operator)
          }
        }
      }

      if (!hasOperator) {
        const value = walker({
          operator: undefined,
          path: [...(options?.path ?? []), key],
          property: key,
          value: query[key],
        })

        if (value !== undefined && value !== query[key]) {
          set(key, value)
        }
      }
    } else {
      const value = walker({
        operator: undefined,
        path: [...(options?.path ?? []), key],
        property: key,
        value: query[key],
      })

      if (value !== undefined && value !== query[key]) {
        set(key, value)
      }
    }
  }

  return query
}

/**
 * Walks the given Feathers query and calls the `walker` function for each property. The
 * `walker` function can return a new value which will replace the original value in the
 * returned query. If no changes were made the original query will be returned.
 *
 * @see https://utils.feathersjs.com/utils/walk-query.html
 */
export const walkQuery = <Q extends Query>(
  query: Q,
  walker: WalkQueryCallback,
): Q => {
  return _walkQueryUtil(query, walker)
}
