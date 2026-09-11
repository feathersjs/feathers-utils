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

it('reset() takes the same criteria or predicate as waitFor()', () => {
  expectTypeOf(calls.reset()).toEqualTypeOf<void>()
  expectTypeOf(
    calls.reset({ path: 'users', method: ['create', 'patch'] }),
  ).toEqualTypeOf<void>()
  expectTypeOf(calls.reset(isContext({ path: 'users' }))).toEqualTypeOf<void>()
  expectTypeOf(
    calls.reset((context) => context.method === 'find'),
  ).toEqualTypeOf<void>()

  // @ts-expect-error "service" is not a criterion — it is called `path`
  calls.reset({ service: 'users' })
})

it('waitFor() resolves with the matching contexts', () => {
  expectTypeOf(calls.waitFor()).toEqualTypeOf<Promise<HookContext[]>>()
  expectTypeOf(
    calls.waitFor({ context: { method: 'create' }, timeout: false }),
  ).toEqualTypeOf<Promise<HookContext[]>>()
  expectTypeOf(
    calls.waitFor({ context: { path: 'users' }, count: 0, timeout: 20 }),
  ).toEqualTypeOf<Promise<HookContext[]>>()
  expectTypeOf(
    calls.waitFor({ context: isContext({ id: null }) }),
  ).toEqualTypeOf<Promise<HookContext[]>>()
  expectTypeOf(
    calls.waitFor({ context: (context) => context.method === 'find' }),
  ).toEqualTypeOf<Promise<HookContext[]>>()

  expectTypeOf(
    calls.waitFor({ resetBefore: true, resetAfter: true }),
  ).toEqualTypeOf<Promise<HookContext[]>>()

  expectTypeOf(calls.waitFor({ count: 0, since: 'now' })).toEqualTypeOf<
    Promise<HookContext[]>
  >()
  expectTypeOf(calls.waitFor({ quietFor: 250, timeout: 2000 })).toEqualTypeOf<
    Promise<HookContext[]>
  >()

  // @ts-expect-error `count` is a number of calls, not a flag
  calls.waitFor({ count: true })
  // @ts-expect-error a baseline is either the record or now
  calls.waitFor({ since: 'later' })
  // @ts-expect-error the criteria are not spread into the options
  calls.waitFor({ path: 'users' })
})

it('the options narrow by the same criteria as reset()', () => {
  recordHooks(app, { type: 'around' })
  recordHooks(app, { type: ['before', 'after', 'error', 'around'] })
  recordHooks(app, { path: 'users', method: ['create', 'patch'] })
  recordHooks(app, { id: 1 })
  recordHooks(app, { id: [1, '2', null] })
  recordHooks(app, { path: ['users', 'todos'], snapshot: true })

  // @ts-expect-error "middle" is not a hook type
  recordHooks(app, { type: 'middle' })
  // @ts-expect-error the service axis is called `path`, like in `isContext`
  recordHooks(app, { service: 'users' })
  // @ts-expect-error `method` is one method or many, not a record
  recordHooks(app, { method: { create: true } })
})
