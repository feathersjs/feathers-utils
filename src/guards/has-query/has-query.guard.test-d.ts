import type { Params } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { hasQuery } from './has-query.guard.js'

it('narrows query from optional to required', () => {
  const params: Params = {}

  if (hasQuery(params)) {
    expectTypeOf(params.query).toEqualTypeOf<Record<string, any>>()
  }
})

it('query is optional before guard', () => {
  const params: Params = {}
  expectTypeOf(params.query).toEqualTypeOf<Record<string, any> | undefined>()
})

it('preserves custom query type', () => {
  const params: Params<{ name: string }> = { query: { name: 'Dave' } }

  if (hasQuery(params)) {
    expectTypeOf(params.query).toEqualTypeOf<{ name: string }>()
  }
})
