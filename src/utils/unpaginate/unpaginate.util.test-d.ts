import { expectTypeOf } from 'vitest'
import type { Paginated } from '@feathersjs/feathers'
import { unpaginate } from './unpaginate.util.js'

type Item = { id: number }

it('infers the item type from an array', () => {
  expectTypeOf(unpaginate([{ id: 1 }])).toEqualTypeOf<Item[]>()
})

it('infers the item type from a paginated result', () => {
  expectTypeOf(unpaginate({} as Paginated<Item>)).toEqualTypeOf<Item[]>()
})

it('returns a non-nullable array for nullable input', () => {
  expectTypeOf(
    unpaginate({} as Item[] | Paginated<Item> | undefined | null),
  ).toEqualTypeOf<Item[]>()
})
