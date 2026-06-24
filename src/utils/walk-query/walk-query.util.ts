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
  /**
   * Stops the traversal. Any replacement value returned from the current walker
   * call is still applied, but no further properties are visited.
   */
  stop: () => void
}

export type WalkQueryCallback = (options: WalkQueryOptions) => any

type WalkQueryState = { stopped: boolean }

const _walkQueryUtil = <Q extends Query>(
  query: Q,
  walker: WalkQueryCallback,
  state: WalkQueryState,
  options?: WalkQueryOptionsInit | WalkQueryOptions,
): Q => {
  const stop = () => {
    state.stopped = true
  }

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
    if (state.stopped) {
      break
    }

    if (
      (key === '$or' || key === '$and' || key === '$nor') &&
      Array.isArray(query[key])
    ) {
      let array = query[key]

      let copiedArray = false

      for (let i = 0, n = array.length; i < n; i++) {
        if (state.stopped) {
          break
        }

        const nestedQuery = array[i]
        const transformed = _walkQueryUtil(nestedQuery, walker, state, {
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
        if (state.stopped) {
          break
        }

        if (operator.startsWith('$')) {
          hasOperator = true
          const value = walker({
            operator,
            path: [...(options?.path ?? []), key],
            property: key,
            value: query[key][operator],
            stop,
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
          stop,
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
        stop,
      })

      if (value !== undefined && value !== query[key]) {
        set(key, value)
      }
    }
  }

  return query
}

/**
 * Walks every property of a Feathers query (including nested `$and`/`$or`/`$nor` arrays)
 * and calls the `walker` function for each one. The walker receives the property name, operator,
 * value, path, and a `stop` function, and can return a replacement value. Calling `stop()` halts
 * the traversal early. Returns a new query only if changes were made.
 *
 * @example
 * ```ts
 * import { walkQuery } from 'feathers-utils/utils'
 *
 * const query = walkQuery({ age: { $gt: '18' } }, ({ value, operator }) => {
 *   if (operator === '$gt') return Number(value)
 * })
 * // => { age: { $gt: 18 } }
 * ```
 *
 * @example
 * ```ts
 * // stop early once a property is found
 * let found = false
 * walkQuery(query, ({ property, stop }) => {
 *   if (property === 'isTemplate') {
 *     found = true
 *     stop()
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/walk-query.html
 */
export const walkQuery = <Q extends Query>(
  query: Q,
  walker: WalkQueryCallback,
): Q => {
  return _walkQueryUtil(query, walker, { stopped: false })
}
