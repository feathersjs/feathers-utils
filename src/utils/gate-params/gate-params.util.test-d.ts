import type { Params } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { gateParams } from './gate-params.util.js'

it('returns a Params object', () => {
  const out = gateParams({ query: {} }, { query: true })
  expectTypeOf(out).toEqualTypeOf<Params>()
})

it('accepts boolean and function rules, including nested paths and custom keys', () => {
  gateParams({ query: {}, user: { id: 1 }, custom: 1 } as Params, {
    query: true,
    paginate: false,
    'user.id': true,
    user: (value, params) => {
      expectTypeOf(value).toBeAny()
      expectTypeOf(params).toEqualTypeOf<Params>()
      return value?.id
    },
    custom: true,
  })
})

it('types onUnknownParams and dropUnknownParams', () => {
  gateParams(
    { query: {} } as Params,
    { query: true },
    {
      dropUnknownParams: true,
      onUnknownParams: (keys, params) => {
        expectTypeOf(keys).toEqualTypeOf<string[]>()
        expectTypeOf(params).toEqualTypeOf<Params>()
      },
    },
  )
})
