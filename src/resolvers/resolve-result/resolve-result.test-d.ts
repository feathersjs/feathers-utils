import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { resolveResult } from './resolve-result.js'
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

it('typed resolver receives correct value types for known keys', () => {
  useHook<Ctx>(resolveResult({
    name: async ({ value }) => {
      expectTypeOf(value).toEqualTypeOf<string | undefined>()
      return value
    },
    id: async ({ value }) => {
      expectTypeOf(value).toEqualTypeOf<number | undefined>()
      return value
    },
  }))
})

it('resolver data parameter is typed as Result', () => {
  useHook<Ctx>(resolveResult({
    name: async ({ data }) => {
      expectTypeOf(data).toEqualTypeOf<User>()
      return data.name
    },
  }))
})

it('resolver context parameter receives HookContext', () => {
  useHook<Ctx>(resolveResult({
    name: async ({ context }) => {
      expectTypeOf(context).toEqualTypeOf<Ctx>()
      return 'test'
    },
  }))
})

it('resolver can return undefined to remove a property', () => {
  useHook<Ctx>(resolveResult({
    password: async () => undefined,
  }))
})

it('untyped resolveResult defaults to Record<string, any>', () => {
  resolveResult({
    anything: async ({ value }) => {
      expectTypeOf(value).toBeAny()
      return value
    },
  })
})
