import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { transformData } from '../../hooks/transform-data/transform-data.hook.js'
import { defaults } from './defaults.transformer.js'
import type { HookFunction } from '../../types.js'

type User = {
  id: number
  name: string
  password: string
  active: boolean
  address: { street: string; city: string }
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('valid static defaults', () => {
  useHook<Ctx>(transformData((item) => defaults(item, { name: 'John' })))
  useHook<Ctx>(
    transformData((item) =>
      defaults(item, { name: 'John', password: 'secret' }),
    ),
  )
  useHook<Ctx>(transformData((item) => defaults(item, { active: true })))
  useHook<Ctx>(transformData((item) => defaults(item, { id: 1 })))
})

it('valid function defaults', () => {
  useHook<Ctx>(transformData((item) => defaults(item, { name: () => 'John' })))
  useHook<Ctx>(transformData((item) => defaults(item, { id: () => 1 })))
  useHook<Ctx>(transformData((item) => defaults(item, { active: () => false })))
})

it('valid dot notation defaults', () => {
  useHook<Ctx>(
    transformData((item) =>
      defaults(item, { 'address.street': '123 Main St' }),
    ),
  )
})

it('rejects wrong value type', () => {
  useHook<Ctx>(
    // @ts-expect-error name is string, not number
    transformData((item) => defaults(item, { name: 123 })),
  )
  useHook<Ctx>(transformData((item) => defaults(item, {})))
  useHook<Ctx>(
    // @ts-expect-error id is number, not string
    transformData((item) => defaults(item, { id: 'not-a-number' })),
  )
  useHook<Ctx>(
    // @ts-expect-error active is boolean, not string
    transformData((item) => defaults(item, { active: 'yes' })),
  )
})

it('rejects wrong function return type', () => {
  useHook<Ctx>(
    // @ts-expect-error name is string, () => number is wrong
    transformData((item) => defaults(item, { name: () => 123 })),
  )
  useHook<Ctx>(
    // @ts-expect-error id is number, () => string is wrong
    transformData((item) => defaults(item, { id: () => 'not-a-number' })),
  )
})

it('rejects non-existent keys', () => {
  useHook<Ctx>(
    // @ts-expect-error "nonExistent" is not a key of User
    transformData((item) => defaults(item, { nonExistent: 'value' })),
  )
})
