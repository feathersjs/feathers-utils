export type MaybeArray<T> = T | readonly T[]
export type UnpackMaybeArray<T> = T extends readonly (infer E)[] ? E : T

export type Promisable<T> = T | Promise<T>
export type KeyOf<T> = Extract<keyof T, string>

export type UnwrapArray<T> = T extends Array<infer U> ? U : T

export type IsAny<T> = 0 extends 1 & T ? true : false

export type AnyFallback<T, Fallback> = IsAny<T> extends true ? Fallback : T

export type NeverFallback<Never, Fallback> = [Never] extends [never]
  ? Fallback
  : Never

export type KeyOfOrDotNotation<D> = KeyOf<D> | `${KeyOf<D>}.${string}`
