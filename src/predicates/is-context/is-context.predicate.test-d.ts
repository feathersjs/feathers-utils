import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { isContext } from './is-context.predicate.js'

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

it('accepts valid path for app-level context', () => {
  isContext<AppCtx>({ path: 'users' })
  isContext<AppCtx>({ path: 'messages' })
  isContext<AppCtx>({ path: ['users', 'messages'] })
})

it('accepts valid path for service-specific context', () => {
  isContext<UserCtx>({ path: 'users' })
})

it('rejects invalid path for app-level context', () => {
  // @ts-expect-error "nonExistent" is not a valid service path
  isContext<AppCtx>({ path: 'nonExistent' })
  // @ts-expect-error "nonExistent" is not a valid service path
  isContext<AppCtx>({ path: ['users', 'nonExistent'] })
})

it('rejects invalid path for service-specific context', () => {
  // @ts-expect-error "messages" is not valid when context is narrowed to MemoryService<User>
  isContext<UserCtx>({ path: 'messages' })
})

it('accepts any string path for untyped context', () => {
  isContext({ path: 'anything' })
  isContext({ path: ['foo', 'bar'] })
})

it('accepts valid type', () => {
  isContext({ type: 'before' })
  isContext({ type: ['before', 'after'] })
})

it('rejects invalid type', () => {
  // @ts-expect-error "invalid" is not a valid HookType
  isContext({ type: 'invalid' })
})

it('accepts valid method', () => {
  isContext({ method: 'create' })
  isContext({ method: ['create', 'patch'] })
})

it('accepts combined options', () => {
  isContext<UserCtx>({ path: 'users', type: 'before', method: 'create' })
})
