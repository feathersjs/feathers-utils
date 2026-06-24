import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { muteEvent } from './mute-event.hook.js'

type User = { id: number; name: string }

const setup = (hooks: any[]) => {
  const app = feathers<{ users: MemoryService<User, Partial<User>> }>()
  app.use('users', new MemoryService({ id: 'id', startId: 1, multi: true }))
  app.service('users').hooks({ around: { all: hooks } })
  return app
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

describe('muteEvent', () => {
  describe('unit', () => {
    it('sets context.event to null', async () => {
      const context = { event: 'created' } as unknown as HookContext
      await muteEvent()(context)
      expect(context.event).toBe(null)
    })

    it('does nothing when `when` is false', async () => {
      const context = { event: 'created' } as unknown as HookContext
      await muteEvent({ when: false })(context)
      expect(context.event).toBe('created')
    })

    it('respects a sync predicate', async () => {
      const muted = { event: 'created' } as unknown as HookContext
      await muteEvent({ when: () => true })(muted)
      expect(muted.event).toBe(null)

      const kept = { event: 'created' } as unknown as HookContext
      await muteEvent({ when: () => false })(kept)
      expect(kept.event).toBe('created')
    })

    it('respects an async predicate', async () => {
      const context = { event: 'created' } as unknown as HookContext
      await muteEvent({ when: async () => true })(context)
      expect(context.event).toBe(null)
    })

    it('calls next when provided', async () => {
      const context = { event: 'created' } as unknown as HookContext
      let called = false
      await muteEvent()(context, async () => {
        called = true
      })
      expect(called).toBe(true)
    })
  })

  describe('integration', () => {
    it('suppresses the created event', async () => {
      const app = setup([muteEvent()])
      let fired = false
      app.service('users').on('created', () => {
        fired = true
      })

      await app.service('users').create({ name: 'test' })
      await tick()

      expect(fired).toBe(false)
    })

    it('emits the event without the hook (control)', async () => {
      const app = setup([])
      let fired = false
      app.service('users').on('created', () => {
        fired = true
      })

      await app.service('users').create({ name: 'test' })
      await tick()

      expect(fired).toBe(true)
    })

    it('emits the event when `when` is false', async () => {
      const app = setup([muteEvent({ when: false })])
      let fired = false
      app.service('users').on('created', () => {
        fired = true
      })

      await app.service('users').create({ name: 'test' })
      await tick()

      expect(fired).toBe(true)
    })

    it('mutes conditionally via a predicate', async () => {
      const app = setup([
        muteEvent({ when: (context) => context.method === 'create' }),
      ])
      let created = false
      let patched = false
      app.service('users').on('created', () => {
        created = true
      })
      app.service('users').on('patched', () => {
        patched = true
      })

      const user = await app.service('users').create({ name: 'test' })
      await app.service('users').patch(user.id, { name: 'changed' })
      await tick()

      expect(created).toBe(false)
      expect(patched).toBe(true)
    })
  })
})
