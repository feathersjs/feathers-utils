import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { isContext } from '../../predicates/index.js'
import { recordHooks } from './record-hooks.testing.js'

const app = feathers()
const calls = recordHooks(app)

it('indexes plain context lists per hook type and method', () => {
  expectTypeOf(calls.all).toEqualTypeOf<HookContext[]>()
  expectTypeOf(calls.before.find).toEqualTypeOf<HookContext[]>()
  expectTypeOf(calls.after.create).toEqualTypeOf<HookContext[]>()
  expectTypeOf(calls.error.get).toEqualTypeOf<HookContext[]>()
  expectTypeOf(calls.around.remove).toEqualTypeOf<HookContext[]>()
  expectTypeOf(calls.around.aCustomMethod).toEqualTypeOf<HookContext[]>()
})

it('reset() takes a predicate on the recorded contexts', () => {
  expectTypeOf(calls.reset()).toEqualTypeOf<void>()
  expectTypeOf(
    calls.reset(isContext({ path: 'users', method: ['create', 'patch'] })),
  ).toEqualTypeOf<void>()
  expectTypeOf(
    calls.reset((context) => context.method === 'find'),
  ).toEqualTypeOf<void>()

  // @ts-expect-error criteria are not a predicate — wrap them in `isContext`
  calls.reset({ path: 'users' })
})

it('the options narrow by the same criteria as reset()', () => {
  recordHooks(app, { type: 'around' })
  recordHooks(app, { type: ['before', 'after', 'error', 'around'] })
  recordHooks(app, { path: 'users', method: ['create', 'patch'] })
  recordHooks(app, { path: ['users', 'todos'], snapshot: true })

  // @ts-expect-error "middle" is not a hook type
  recordHooks(app, { type: 'middle' })
  // @ts-expect-error the service axis is called `path`, like in `isContext`
  recordHooks(app, { service: 'users' })
  // @ts-expect-error `method` is one method or many, not a record
  recordHooks(app, { method: { create: true } })
})
