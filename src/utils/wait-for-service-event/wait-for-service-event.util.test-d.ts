import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { waitForServiceEvent } from './wait-for-service-event.util.js'

type User = {
  id: number
  name: string
  email: string
}

const app = feathers<{ users: MemoryService<User> }>()

it('currying returns a callable bound to the app', () => {
  expectTypeOf(waitForServiceEvent(app)).toBeFunction()
  // service-agnostic defaults are accepted
  waitForServiceEvent(app, { timeout: false })
  waitForServiceEvent(app, { timeout: 1000 })
})

it('resolves a [data, { event, context }] tuple typed by the service', async () => {
  const waitForEvent = waitForServiceEvent(app)

  const [data, meta] = await waitForEvent('users', 'created')
  expectTypeOf(data).toEqualTypeOf<User>()
  expectTypeOf(meta.context).toEqualTypeOf<HookContext>()
})

it('event is the literal union of the requested events', async () => {
  const waitForEvent = waitForServiceEvent(app)

  const [, single] = await waitForEvent('users', 'created')
  expectTypeOf(single.event).toEqualTypeOf<'created'>()

  const [, many] = await waitForEvent('users', ['created', 'patched'])
  expectTypeOf(many.event).toEqualTypeOf<'created' | 'patched'>()
})

it('filter receives the record and the hook context', () => {
  const waitForEvent = waitForServiceEvent(app)

  waitForEvent('users', 'created', {
    filter: (data, context) => {
      expectTypeOf(data).toEqualTypeOf<User>()
      expectTypeOf(context).toEqualTypeOf<HookContext>()
      return true
    },
  })
})

it('rejects unknown service paths', () => {
  const waitForEvent = waitForServiceEvent(app)

  // @ts-expect-error - 'unknown' is not a registered service
  waitForEvent('unknown', 'created')
})
