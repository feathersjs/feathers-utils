import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { resolve } from './resolve.js'
import type { HookFunction } from '../../types.js'

type User = {
  id: number
  name: string
  password: string
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('accepts data resolver only', () => {
  useHook<Ctx>(
    resolve({
      data: {
        name: async () => 'lowered',
      },
    }),
  )
})

it('accepts result resolver only', () => {
  useHook<Ctx>(
    resolve({
      result: {
        password: async () => undefined,
      },
    }),
  )
})

it('accepts query resolver only', () => {
  useHook<Ctx>(
    resolve({
      query: {
        active: async () => true,
      },
    }),
  )
})

it('accepts all resolvers combined', () => {
  useHook<Ctx>(
    resolve({
      data: {
        name: async () => 'lowered',
      },
      query: {
        active: async () => true,
      },
      result: {
        password: async () => undefined,
      },
    }),
  )
})
