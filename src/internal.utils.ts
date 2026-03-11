import type { HookContext } from '@feathersjs/feathers'

export const hasOwnProperty = (
  obj: Record<string, unknown>,
  ...keys: string[]
): boolean => {
  return keys.some((x) => Object.prototype.hasOwnProperty.call(obj, x))
}

export type MaybeArray<T> = T | readonly T[]
export type UnpackMaybeArray<T> = T extends readonly (infer E)[] ? E : T
export const toArray = <T>(value: T | readonly T[]): T[] =>
  Array.isArray(value) ? [...value] : [value as T]

export type Promisable<T> = T | Promise<T>
export type KeyOf<T> = Extract<keyof T, string>

export type UnwrapArray<T> = T extends Array<infer U> ? U : T

export type IsAny<T> = 0 extends 1 & T ? true : false

export type AnyFallback<T, Fallback> = IsAny<T> extends true ? Fallback : T

export type NeverFallback<Never, Fallback> = [Never] extends [never]
  ? Fallback
  : Never

export type KeyOfOrDotNotation<D> = KeyOf<D> | `${KeyOf<D>}.${string}`

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
