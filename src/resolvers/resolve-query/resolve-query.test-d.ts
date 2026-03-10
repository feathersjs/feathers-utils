import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { resolveQuery } from './resolve-query.js'
import type { HookFunction } from '../../types.js'

type User = {
  id: number
  name: string
  email: string
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('resolver receives any-typed values (query is untyped)', () => {
  resolveQuery({
    name: async ({ value }) => {
      expectTypeOf(value).toBeAny()
      return value
    },
  })
})

it('resolver context parameter receives HookContext', () => {
  useHook<Ctx>(resolveQuery({
    name: async ({ context }) => {
      expectTypeOf(context).toEqualTypeOf<Ctx>()
      return 'test'
    },
  }))
})

it('allows any property names', () => {
  resolveQuery({
    active: async () => true,
    $limit: async () => 10,
    customField: async () => 'value',
  })
})

it('works as a hook with typed context', () => {
  useHook<Ctx>(resolveQuery({
    active: async () => true,
  }))
})
