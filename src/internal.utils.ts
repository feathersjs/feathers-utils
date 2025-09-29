import type { HookContext } from '@feathersjs/feathers'

export const hasOwnProperty = (
  obj: Record<string, unknown>,
  ...keys: string[]
): boolean => {
  return keys.some((x) => Object.prototype.hasOwnProperty.call(obj, x))
}

export type MaybeArray<T> = T | T[]
export const toArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value]

export type Promisable<T> = T | Promise<T>
export type KeyOf<T> = Extract<keyof T, string>

/**+
 * Can be used to early return a hook.
 *
 * If it's an around hook, it will call `next` if provided.
 */
export const early = <H extends HookContext>(
  context: H,
  next?: (context: H) => Promisable<void>,
): Promisable<void> => {
  if (next) {
    return next(context)
  }
  return
}

/**
 * Checks if a value is a Promise.
 */
export const isPromise = (value: any): value is Promise<any> => {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  )
}
