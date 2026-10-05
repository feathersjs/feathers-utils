import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { stash } from '../../utils/define-stash/define-stash.util.js'
import { skipUnchanged } from './skip-unchanged.hook.js'
import type { SkipUnchangedOptions } from './skip-unchanged.hook.js'

type User = {
  id: number
  name: string
  role: string
  updatedAt?: number
}

const registrations = ['before', 'around'] as const

const setup = async (
  registration: (typeof registrations)[number],
  options?: SkipUnchangedOptions,
) => {
  const app = feathers<{ users: MemoryService<User> }>()
  app.use('users', new MemoryService<User>({ startId: 1, multi: true }))
  const users = app.service('users')
  await users.create([
    { name: 'Anna', role: 'admin' },
    { name: 'Ben', role: 'admin' },
  ])

  const hook = skipUnchanged(options)
  users.hooks({ [registration]: { patch: [hook] } })

  const _patch = vi.spyOn(users, '_patch')
  const find = vi.spyOn(users, 'find')
  const events: User[] = []
  users.on('patched', (user: User) => events.push(user))
  return { users, _patch, find, events }
}

describe('skipUnchanged', () => {
  describe.each(registrations)('registered %s', (registration) => {
    it('drops the fields that keep their stored value', async () => {
      const { users, _patch } = await setup(registration)

      await users.patch(1, { name: 'Anne', role: 'admin' })

      expect(_patch.mock.calls[0]![1]).toEqual({ name: 'Anne' })
    })

    it('skips the write and the event if nothing changes', async () => {
      const { users, _patch, events } = await setup(registration)

      expect(await users.patch(1, { name: 'Anna', role: 'admin' })).toEqual({
        id: 1,
        name: 'Anna',
        role: 'admin',
      })
      expect(_patch).not.toHaveBeenCalled()
      expect(events).toEqual([])
    })

    it('skips the write if only ignored fields change', async () => {
      const { users, _patch } = await setup(registration, {
        ignore: 'updatedAt',
      })

      await users.patch(1, { name: 'Anna', updatedAt: 5 })
      expect(_patch).not.toHaveBeenCalled()

      // written along with a field that changes
      await users.patch(1, { name: 'Anne', updatedAt: 5 })
      expect(_patch.mock.calls[0]![1]).toEqual({ name: 'Anne', updatedAt: 5 })
    })

    it('keeps a field a multi patch changes for one of the items', async () => {
      const { users, _patch } = await setup(registration)

      // the role stays for both, the name changes for Ben
      await users.patch(null, { name: 'Anna', role: 'admin' }, { query: {} })

      expect(_patch.mock.calls[0]![1]).toEqual({ name: 'Anna' })
    })

    it('returns the stored items of a multi patch that changes nothing', async () => {
      const { users, _patch, events } = await setup(registration)

      expect(
        await users.patch(null, { role: 'admin' }, { query: {} }),
      ).toMatchObject([{ id: 1 }, { id: 2 }])
      expect(_patch).not.toHaveBeenCalled()
      expect(events).toEqual([])
    })

    it('applies the $select of the call to the stored items', async () => {
      const { users } = await setup(registration)

      expect(
        await users.patch(
          1,
          { role: 'admin' },
          { query: { $select: ['name'] } },
        ),
      ).toEqual({ id: 1, name: 'Anna' })
    })
  })

  it('counts a key with a dot as a change', async () => {
    const { users, _patch } = await setup('before')

    await users.patch(1, { 'meta.tag': 'x' } as any)

    expect(_patch).toHaveBeenCalledOnce()
  })

  it('leaves a patch alone that matches no item', async () => {
    const { users } = await setup('before')

    await expect(users.patch(99, { name: 'x' })).rejects.toThrow(
      'No record found',
    )
  })

  it('shares the fetch of the whole items with stash', async () => {
    const service = new MemoryService<User>({ startId: 1 })
    await service.create({ name: 'Anna', role: 'admin' })
    const find = vi.spyOn(service, 'find')

    await runHook(
      async (context: HookContext) => {
        await skipUnchanged()(context)
        await stash(context)
      },
      {
        type: 'before',
        method: 'patch',
        id: 1,
        data: { name: 'Anne' },
        service,
      },
    )

    expect(find).toHaveBeenCalledOnce()
  })

  it('throws outside before and around hooks, and for other methods', async () => {
    await expect(
      runHook(skipUnchanged(), {
        type: 'after',
        method: 'patch',
        id: 1,
        data: {},
        result: {},
      }),
    ).rejects.toThrow("The 'skipUnchanged' hook has invalid context")
    await expect(
      runHook(skipUnchanged(), {
        type: 'before',
        method: 'update',
        id: 1,
        data: {},
      }),
    ).rejects.toThrow("The 'skipUnchanged' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const data = await expectNoSideEffects(
      {
        params: { query: { $select: ['name'] } },
        data: { name: 'Anne', role: 'admin' },
      },
      async ({ params, data }) => {
        const service = new MemoryService<User>({ startId: 1 })
        await service.create({ name: 'Anna', role: 'admin' })

        const context = await runHook(skipUnchanged(), {
          type: 'before',
          method: 'patch',
          id: 1,
          data,
          params,
          service,
        })
        return context.data
      },
    )

    expect(data).toEqual({ name: 'Anne' })
  })
})
