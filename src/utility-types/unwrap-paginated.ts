import type { Paginated } from '@feathersjs/feathers'

export type UnwrapPaginated<R> = R extends Paginated<infer D> ? D : R

export type UnwrapPaginatedOrArray<T> =
  T extends Paginated<infer D> ? D : T extends any[] ? T[number] : T
