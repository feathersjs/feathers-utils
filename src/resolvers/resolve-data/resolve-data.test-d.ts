import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { resolveData } from './resolve-data.js'
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

it('typed resolver receives correct value types for known keys', () => {
  useHook<Ctx>(
    resolveData({
      name: async ({ value }) => {
        expectTypeOf(value).toEqualTypeOf<string | undefined>()
        return value
      },
      id: async ({ value }) => {
        expectTypeOf(value).toEqualTypeOf<number | undefined>()
        return value
      },
    }),
  )
})

it('resolver data parameter has known properties', () => {
  useHook<Ctx>(
    resolveData({
      name: async ({ data }) => {
        expectTypeOf(data.name).toEqualTypeOf<string | undefined>()
        expectTypeOf(data.id).toEqualTypeOf<number | undefined>()
        return data.name
      },
    }),
  )
})

it('resolver context parameter receives HookContext', () => {
  useHook<Ctx>(
    resolveData({
      name: async ({ context }) => {
        expectTypeOf(context).toEqualTypeOf<Ctx>()
        return 'test'
      },
    }),
  )
})

it('resolver can return undefined to remove a property', () => {
  useHook<Ctx>(
    resolveData({
      email: async () => undefined,
    }),
  )
})

it('untyped resolveData defaults to Record<string, any>', () => {
  resolveData({
    anything: async ({ value }) => {
      expectTypeOf(value).toBeAny()
      return value
    },
  })
})
