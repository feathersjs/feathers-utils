import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { checkContext } from './check-context.util.js'

type User = {
  id: number
  name: string
}

const app = feathers<{
  users: MemoryService<User>
  messages: MemoryService
}>()

type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

const context = {} as Ctx

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
