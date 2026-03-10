import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { transformResult } from './transform-result.hook.js'
import { omit } from '../../transformers/omit/omit.transformer.js'
import { lowercase } from '../../transformers/lowercase/lowercase.transformer.js'
import { parseDate } from '../../transformers/parse-date/parse-date.transformer.js'
import { pick } from '../../transformers/pick/pick.transformer.js'
import { setNow } from '../../transformers/set-now/set-now.transformer.js'
import { trim } from '../../transformers/trim/trim.transformer.js'
import { defaults } from '../../transformers/defaults/defaults.transformer.js'
import type { HookFunction } from '../../types.js'

type User = {
  id: number
  name: string
  password: string
  address: { street: string; city: string }
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('omit', () => {
  useHook<Ctx>(transformResult((item) => omit(item, 'password')))
  useHook<Ctx>(transformResult((item) => omit(item, 'address.street')))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => omit(item, 'nonExistent')))
  // @ts-expect-error "nonExistent.foo" has invalid top-level key
  useHook<Ctx>(transformResult((item) => omit(item, 'nonExistent.foo')))
})

it('lowercase', () => {
  useHook<Ctx>(transformResult((item) => lowercase(item, 'name')))
  useHook<Ctx>(transformResult((item) => lowercase(item, ['name', 'password'])))
  useHook<Ctx>(transformResult((item) => lowercase(item, 'address.street')))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => lowercase(item, 'nonExistent')))
  // @ts-expect-error "id" is number, not string
  useHook<Ctx>(transformResult((item) => lowercase(item, 'id')))
})

it('parseDate', () => {
  useHook<Ctx>(transformResult((item) => parseDate(item, 'name')))
  useHook<Ctx>(transformResult((item) => parseDate(item, ['name', 'password'])))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => parseDate(item, 'nonExistent')))
})

it('pick', () => {
  useHook<Ctx>(transformResult((item) => pick(item, 'name')))
  useHook<Ctx>(transformResult((item) => pick(item, ['name', 'password'])))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => pick(item, 'nonExistent')))
})

it('setNow', () => {
  useHook<Ctx>(transformResult((item) => setNow(item, 'name')))
  useHook<Ctx>(transformResult((item) => setNow(item, ['name', 'password'])))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => setNow(item, 'nonExistent')))
})

it('trim', () => {
  useHook<Ctx>(transformResult((item) => trim(item, 'name')))
  useHook<Ctx>(transformResult((item) => trim(item, ['name', 'password'])))
  useHook<Ctx>(transformResult((item) => trim(item, 'address.street')))

  // @ts-expect-error "nonExistent" is not a key of User
  useHook<Ctx>(transformResult((item) => trim(item, 'nonExistent')))
  // @ts-expect-error "id" is number, not string
  useHook<Ctx>(transformResult((item) => trim(item, 'id')))
})

it('defaults', () => {
  useHook<Ctx>(transformResult((item) => defaults(item, { name: 'John' })))
  useHook<Ctx>(
    transformResult((item) => defaults(item, { name: 'John', password: 'secret' })),
  )
  useHook<Ctx>(
    transformResult((item) => defaults(item, { 'address.street': '123 Main St' })),
  )
  useHook<Ctx>(transformResult((item) => defaults(item, { name: () => 'John' })))

  useHook<Ctx>(
    // @ts-expect-error "nonExistent" is not a key of User
    transformResult((item) => defaults(item, { nonExistent: 'value' })),
  )
})

it('untyped context defaults to Record<string, any>', () => {
  const _hook = transformResult((item) => {
    expectTypeOf(item).toEqualTypeOf<Record<string, any>>()
  })
})
