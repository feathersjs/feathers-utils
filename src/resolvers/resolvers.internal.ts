import { BadRequest } from '@feathersjs/errors'
import type { Promisable } from '../internal.utils.js'
import { setOwnProperty } from '../common/index.js'

export interface ResolverPropertyOptions<T, V, C> {
  value: V | undefined
  data: T
  context: C
  properties: ResolverStatus<T, C>
  i: number
}

export type ResolverProperty<T, V, C, R = V> = (
  options: ResolverPropertyOptions<T, V, C>,
) => Promisable<R | undefined>

export type ResolverObject<T, C> = {
  [K in keyof T & string]?: ResolverProperty<T, T[K], C, T[K]>
}

export interface ResolverStatus<T, C> {
  path: string[]
  stack: ResolverProperty<T, any, C>[]
}

export interface ResolveOptions<T, D extends Record<string, any>, C> {
  resolvers: ResolverObject<T, C>
  data: D
  context: C
  status?: Partial<ResolverStatus<T, C>>
  propertyNames?: (keyof T)[]
  i?: number
}

const toError = (error: any) =>
  typeof error.toJSON === 'function'
    ? error.toJSON()
    : { message: error.message || error }

export const resolve = <T, D extends Record<string, any>, C>(
  options: ResolveOptions<T, D, C>,
): Promise<T> | T => {
  const {
    resolvers,
    data,
    context,
    status,
    propertyNames = Object.keys(resolvers) as any as (keyof T)[],
    i = 0,
  } = options

  if (!propertyNames.length) {
    return data as any as T
  }

  const propertyList = [
    ...new Set(Object.keys(data).concat(propertyNames as string[])),
  ]

  const result: any = {}
  const errors: any = {}
  let hasErrors = false
  const { path = [], stack = [] } = status || {}
  const promises: Promise<void>[] = []

  for (const name of propertyList) {
    const value = (data as any)[name]

    // own keys only: `name` comes from the data, and `in` would also match
    // `constructor`, `toString` & co. of `Object.prototype`
    if (!Object.hasOwn(resolvers, name)) {
      if (value !== undefined) {
        setOwnProperty(result, name, value)
      }
      continue
    }

    const resolver = (resolvers as any)[name] as ResolverProperty<T, any, C>

    if (stack.includes(resolver)) {
      continue
    }

    const properties: ResolverStatus<T, C> = {
      ...status,
      path: [...path, name],
      stack: [...stack, resolver],
    }

    try {
      const resolved = resolver({
        value,
        data: data as any,
        context,
        properties,
        i,
      })

      if (resolved instanceof Promise) {
        promises.push(
          resolved
            .then((val) => {
              if (val !== undefined) {
                setOwnProperty(result, name, val)
              }
            })
            .catch((error: any) => {
              setOwnProperty(errors, name, toError(error))
              hasErrors = true
            }),
        )
      } else if (resolved !== undefined) {
        setOwnProperty(result, name, resolved)
      }
    } catch (error: any) {
      setOwnProperty(errors, name, toError(error))
      hasErrors = true
    }
  }

  const finalize = () => {
    if (hasErrors) {
      throw new BadRequest('Error resolving data', errors)
    }
    return result as T
  }

  if (promises.length) {
    return Promise.all(promises).then(finalize)
  }

  return finalize()
}
