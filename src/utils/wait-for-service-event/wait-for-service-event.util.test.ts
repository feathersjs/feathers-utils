import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { waitForServiceEvent } from './wait-for-service-event.util.js'

type User = {
  id: number
  name: string
  email?: string
}

const setup = () => {
  const app = feathers<{ users: MemoryService<User, Partial<User>> }>()

  app.use('users', new MemoryService({ id: 'id', startId: 1, multi: true }))

  const usersService = app.service('users')
  const waitForEvent = waitForServiceEvent(app)

  return { app, usersService, waitForEvent }
}

describe('waitForServiceEvent', function () {
  it('resolves with { event, data, context } when the event fires', async function () {
    const { usersService, waitForEvent } = setup()

    const promise = waitForEvent('users', 'created')
    const created = await usersService.create({ name: 'jane' })
    const result = await promise

    expect(result.event).toBe('created')
    expect(result.data).toEqual(created)
    expect(result.context.method).toBe('create')
    // listeners are cleaned up after resolving
    expect(usersService.listenerCount('created')).toBe(0)
  })

  it('only resolves for events whose data passes the filter', async function () {
    const { usersService, waitForEvent } = setup()

    const promise = waitForEvent('users', 'created', {
      filter: (user) => user.name === 'match',
    })

    await usersService.create({ name: 'nomatch' })
    const wanted = await usersService.create({ name: 'match' })
    const result = await promise

    expect(result.data).toEqual(wanted)
    expect(usersService.listenerCount('created')).toBe(0)
  })

  it('passes the hook context as the second filter argument', async function () {
    const { usersService, waitForEvent } = setup()

    let seenMethod: string | undefined

    const promise = waitForEvent('users', 'created', {
      filter: (_user, context) => {
        seenMethod = context.method
        return true
      },
    })

    await usersService.create({ name: 'jane' })
    await promise

    expect(seenMethod).toBe('create')
  })

  it('resolves on the first of multiple events and reports which fired', async function () {
    const { usersService, waitForEvent } = setup()

    const created = await usersService.create({ name: 'jane' })

    const promise = waitForEvent('users', ['created', 'patched'])
    const patched = await usersService.patch(created.id, { name: 'jane2' })
    const result = await promise

    expect(result.event).toBe('patched')
    expect(result.data).toEqual(patched)
    expect(usersService.listenerCount('created')).toBe(0)
    expect(usersService.listenerCount('patched')).toBe(0)
  })

  it('rejects after the timeout and detaches listeners', async function () {
    const { usersService, waitForEvent } = setup()

    await expect(
      waitForEvent('users', 'created', { timeout: 50 }),
    ).rejects.toThrow(/Timeout waiting for event "created" on service "users"/)

    expect(usersService.listenerCount('created')).toBe(0)
  })

  it('uses the timeout bound as a default when currying', async function () {
    const { app } = setup()
    const waitForEvent = waitForServiceEvent(app, { timeout: 50 })

    await expect(waitForEvent('users', 'created')).rejects.toThrow(/Timeout/)
  })

  it('lets a per-call timeout override the bound default', async function () {
    const { app, usersService } = setup()
    const waitForEvent = waitForServiceEvent(app, { timeout: 1 })

    const promise = waitForEvent('users', 'created', { timeout: false })
    const created = await usersService.create({ name: 'jane' })
    const result = await promise

    expect(result.data).toEqual(created)
  })

  it('never times out when timeout is false', async function () {
    const { usersService, waitForEvent } = setup()

    const promise = waitForEvent('users', 'created', { timeout: false })
    const created = await usersService.create({ name: 'jane' })
    const result = await promise

    expect(result.data).toEqual(created)
  })

  it('rejects when the AbortSignal aborts while waiting', async function () {
    const { usersService, waitForEvent } = setup()

    const ac = new AbortController()
    const promise = waitForEvent('users', 'created', { signal: ac.signal })
    ac.abort(new Error('stop waiting'))

    await expect(promise).rejects.toThrow('stop waiting')
    expect(usersService.listenerCount('created')).toBe(0)
  })

  it('rejects immediately when the signal is already aborted', async function () {
    const { usersService, waitForEvent } = setup()

    const ac = new AbortController()
    ac.abort(new Error('already gone'))

    await expect(
      waitForEvent('users', 'created', { signal: ac.signal }),
    ).rejects.toThrow('already gone')
    expect(usersService.listenerCount('created')).toBe(0)
  })
})
