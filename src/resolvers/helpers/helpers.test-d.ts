import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { resolveResult } from '../resolve-result/resolve-result.js'
import { resolveData } from '../resolve-data/resolve-data.js'
import { omit } from './omit/omit.js'
import { trim } from './trim/trim.js'
import { lowercase } from './lowercase/lowercase.js'
import { defaults } from './defaults/defaults.js'
import { setNow } from './set-now/set-now.js'
import type { HookFunction } from '../../types.js'
import type { ResolverCondition } from '../resolver-condition.js'
import type { ResolverPropertyOptions } from '../resolvers.internal.js'

type User = {
  id: number
  name: string
  email: string
  password: string
  createdAt: number
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('omit works in resolveResult', () => {
  useHook<Ctx>(
    resolveResult({
      password: omit(),
    }),
  )
})

it('omit with condition works in resolveResult', () => {
  const isExternal: ResolverCondition<Ctx> = ({ context }) =>
    !!context.params.provider
  useHook<Ctx>(
    resolveResult({
      password: omit(isExternal),
    }),
  )
})

it('trim works in resolveData', () => {
  useHook<Ctx>(
    resolveData({
      name: trim(),
    }),
  )
})

it('lowercase works in resolveData', () => {
  useHook<Ctx>(
    resolveData({
      email: lowercase(),
    }),
  )
})

it('defaults works in resolveData', () => {
  useHook<Ctx>(
    resolveData({
      name: defaults('unknown'),
    }),
  )
})

it('defaults with function works in resolveData', () => {
  useHook<Ctx>(
    resolveData({
      createdAt: defaults((ctx: Ctx) => Date.now()),
    }),
  )
})

it('setNow works in resolveData', () => {
  useHook<Ctx>(
    resolveData({
      createdAt: setNow(),
    }),
  )
})

it('ResolverCondition receives ResolverPropertyOptions', () => {
  const condition: ResolverCondition<Ctx> = (options) => {
    expectTypeOf(options).toEqualTypeOf<
      ResolverPropertyOptions<any, any, Ctx>
    >()
    expectTypeOf(options.context).toEqualTypeOf<Ctx>()
    return true
  }
})
