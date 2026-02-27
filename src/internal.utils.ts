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

export type UnwrapArray<T> = T extends Array<infer U> ? U : T

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
