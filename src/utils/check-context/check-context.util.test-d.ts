import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { checkContext } from './check-context.util.js'

type User = {
  id: number
  name: string
}

type Message = {
  id: number
  text: string
}

const app = feathers<{
  users: MemoryService<User>
  messages: MemoryService<Message>
}>()

type App = typeof app
type AppCtx = HookContext<App>
type UserCtx = HookContext<App, MemoryService<User>>

it('options overload accepts valid options', () => {
  const ctx1 = {} as UserCtx
  checkContext(ctx1, { type: 'before' })
  const ctx2 = {} as UserCtx
  checkContext(ctx2, { method: 'create' })
  const ctx3 = {} as UserCtx
  checkContext(ctx3, {
    type: ['before', 'around'],
    method: ['create', 'patch'],
  })
  const ctx4 = {} as UserCtx
  checkContext(ctx4, { type: 'before', label: 'myHook' })
  const ctx5 = {} as UserCtx
  checkContext(ctx5, { path: 'users' })
})

it('options overload rejects invalid type', () => {
  const ctx = {} as UserCtx
  // @ts-expect-error "invalid" is not a valid HookType
  checkContext(ctx, { type: 'invalid' })
})

it('options overload accepts valid path for app-level context', () => {
  const ctx1 = {} as AppCtx
  checkContext(ctx1, { path: 'users' })
  const ctx2 = {} as AppCtx
  checkContext(ctx2, { path: 'messages' })
  const ctx3 = {} as AppCtx
  checkContext(ctx3, { path: ['users', 'messages'] })
})

it('options overload rejects invalid path for service-specific context', () => {
  const ctx = {} as UserCtx
  // @ts-expect-error "messages" is not valid when context is narrowed to MemoryService<User>
  checkContext(ctx, { path: 'messages' })
})

it('options overload rejects invalid path for app-level context', () => {
  const ctx = {} as AppCtx
  // @ts-expect-error "nonExistent" is not a valid service path
  checkContext(ctx, { path: 'nonExistent' })
})

it('positional overload accepts valid args', () => {
  const ctx1 = {} as UserCtx
  checkContext(ctx1, 'before')
  const ctx2 = {} as UserCtx
  checkContext(ctx2, ['before', 'after'])
  const ctx3 = {} as UserCtx
  checkContext(ctx3, 'before', 'create')
  const ctx4 = {} as UserCtx
  checkContext(ctx4, ['before', 'around'], ['create', 'patch'], 'myHook')
  const ctx5 = {} as UserCtx
  checkContext(ctx5, null, 'create')
  const ctx6 = {} as UserCtx
  checkContext(ctx6, undefined, 'create')
})

it('positional overload rejects invalid type', () => {
  // @ts-expect-error "invalid" is not a valid HookType
  checkContext(context, 'invalid')
})

it('narrows path with options overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, { path: ['users', 'messages'] })
  expectTypeOf(ctx.path).toEqualTypeOf<'users' | 'messages'>()
})

it('narrows path with single value', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, { path: 'users' })
  expectTypeOf(ctx.path).toEqualTypeOf<'users'>()
})

it('narrows type with options overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, { type: ['before', 'around'] })
  expectTypeOf(ctx.type).toEqualTypeOf<'before' | 'around'>()
})

it('narrows method with options overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, { method: ['create', 'patch'] })
  expectTypeOf(ctx.method).toEqualTypeOf<'create' | 'patch'>()
})

it('narrows type with positional overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, 'before')
  expectTypeOf(ctx.type).toEqualTypeOf<'before'>()
})

it('narrows type and method with positional overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, ['before', 'around'], ['create', 'patch'])
  expectTypeOf(ctx.type).toEqualTypeOf<'before' | 'around'>()
  expectTypeOf(ctx.method).toEqualTypeOf<'create' | 'patch'>()
})

it('does not narrow when null is passed in positional overload', () => {
  const ctx = {} as AppCtx
  checkContext(ctx, null, 'create')
  expectTypeOf(ctx.method).toEqualTypeOf<'create'>()
})
