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

const context = {} as UserCtx
const appContext = {} as AppCtx

it('options overload accepts valid options', () => {
  checkContext(context, { type: 'before' })
  checkContext(context, { method: 'create' })
  checkContext(context, {
    type: ['before', 'around'],
    method: ['create', 'patch'],
  })
  checkContext(context, { type: 'before', label: 'myHook' })
  checkContext(context, { path: 'users' })
})

it('options overload rejects invalid type', () => {
  // @ts-expect-error "invalid" is not a valid HookType
  checkContext(context, { type: 'invalid' })
})

it('options overload accepts valid path for app-level context', () => {
  checkContext(appContext, { path: 'users' })
  checkContext(appContext, { path: 'messages' })
  checkContext(appContext, { path: ['users', 'messages'] })
})

it('options overload rejects invalid path for service-specific context', () => {
  // @ts-expect-error "messages" is not valid when context is narrowed to MemoryService<User>
  checkContext(context, { path: 'messages' })
})

it('options overload rejects invalid path for app-level context', () => {
  // @ts-expect-error "nonExistent" is not a valid service path
  checkContext(appContext, { path: 'nonExistent' })
})

it('positional overload accepts valid args', () => {
  checkContext(context, 'before')
  checkContext(context, ['before', 'after'])
  checkContext(context, 'before', 'create')
  checkContext(context, ['before', 'around'], ['create', 'patch'], 'myHook')
  checkContext(context, null, 'create')
  checkContext(context, undefined, 'create')
})

it('positional overload rejects invalid type', () => {
  // @ts-expect-error "invalid" is not a valid HookType
  checkContext(context, 'invalid')
})
