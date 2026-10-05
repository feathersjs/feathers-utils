import { BadRequest, Conflict } from '@feathersjs/errors'
import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { unique } from './unique.hook.js'
import type { UniqueConflict, UniqueOptions } from './unique.hook.js'

type User = {
  id: number
  tenantId: number
  email: string | null
  deletedAt: number | null
  name?: string
}

const seed: Omit<User, 'id'>[] = [
  { tenantId: 1, email: 'anna@x.de', deletedAt: null },
  { tenantId: 1, email: 'ben@x.de', deletedAt: null },
  { tenantId: 2, email: 'anna@x.de', deletedAt: null },
  { tenantId: 1, email: 'old@x.de', deletedAt: 123 },
  // a deleted duplicate of anna in tenant 1
  { tenantId: 1, email: 'anna@x.de', deletedAt: 9 },
]

const setup = async (
  options: UniqueOptions<HookContext, User> = {
    fields: ['tenantId', 'email'],
    where: { deletedAt: null },
  },
) => {
  const app = feathers<{ users: MemoryService<User> }>()
  app.use('users', new MemoryService<User>({ multi: true, startId: 1 }))
  const users = app.service('users')
  await users.create(seed)

  const hook = unique<HookContext, User>(options)
  users.hooks({
    before: { create: [hook], update: [hook], patch: [hook] },
  })

  const _find = vi.spyOn(users, '_find')
  const find = vi.spyOn(users, 'find')
  return { app, users, _find, find }
}

describe('unique', () => {
  describe('create and update', () => {
    it('throws a Conflict for a duplicate of a stored item', async () => {
      const { users } = await setup()

      const error = await users
        .create({ tenantId: 1, email: 'anna@x.de', deletedAt: null })
        .catch((error) => error)

      expect(error).toBeInstanceOf(Conflict)
      expect(error.message).toBe(
        "'tenantId', 'email' have to be unique together",
      )
      expect(error.data).toEqual({ fields: ['tenantId', 'email'] })
    })

    it('lets items differ in one of the fields', async () => {
      const { users } = await setup()

      await expect(
        users.create({ tenantId: 3, email: 'anna@x.de', deletedAt: null }),
      ).resolves.toMatchObject({ id: 6 })
    })

    it('finds duplicates among the items of a multi create', async () => {
      const { users, _find } = await setup()

      await expect(
        users.create([
          { tenantId: 5, email: 'new@x.de', deletedAt: null },
          { tenantId: 5, email: 'new@x.de', deletedAt: null },
        ]),
      ).rejects.toBeInstanceOf(Conflict)
      expect(_find).not.toHaveBeenCalled()
    })

    it('throws for a multi create of which one item duplicates a stored one', async () => {
      const { users } = await setup()

      await expect(
        users.create([
          { tenantId: 5, email: 'new@x.de', deletedAt: null },
          { tenantId: 1, email: 'ben@x.de', deletedAt: null },
        ]),
      ).rejects.toBeInstanceOf(Conflict)
      expect(await users.find({ query: { tenantId: 5 } })).toEqual([])
    })

    it('checks update against the other items', async () => {
      const { users } = await setup()

      await expect(
        users.update(1, { tenantId: 1, email: 'anna@x.de', deletedAt: null }),
      ).resolves.toMatchObject({ id: 1 })
      await expect(
        users.update(2, { tenantId: 1, email: 'anna@x.de', deletedAt: null }),
      ).rejects.toBeInstanceOf(Conflict)
    })
  })

  describe('patch', () => {
    it('does not check when data has neither the fields nor those of where', async () => {
      const { users, _find, find } = await setup()

      await users.patch(1, { name: 'Anna' })

      expect(_find).not.toHaveBeenCalled()
      expect(find).not.toHaveBeenCalled()
    })

    it('fetches the whole items with select: false', async () => {
      const { users, find } = await setup({
        fields: ['tenantId', 'email'],
        select: false,
      })

      await users.patch(1, { email: 'anna@x.de' })

      expect(find).toHaveBeenCalledWith({ query: { id: 1 }, paginate: false })
    })

    it('does not count the item against itself', async () => {
      const { users } = await setup()

      await expect(
        users.patch(1, { email: 'anna@x.de' }),
      ).resolves.toMatchObject({ id: 1 })
    })

    it('does not query when the values stay as they are', async () => {
      const { users, _find, find } = await setup()

      // the tenant and `deletedAt` are fetched, nothing changes
      await users.patch(1, { email: 'anna@x.de', name: 'Anna' })

      // the fetch: `find`, which calls `_find` - the check would be a second one
      expect(find).toHaveBeenCalledOnce()
      expect(_find).toHaveBeenCalledOnce()
      expect(_find.mock.calls[0]![0]!.query).not.toHaveProperty('$limit')
    })

    it('throws for a duplicate of another item', async () => {
      const { users } = await setup()

      await expect(
        users.patch(2, { email: 'anna@x.de' }),
      ).rejects.toBeInstanceOf(Conflict)
    })

    it('reads the fields data lacks from the database', async () => {
      const { users, find } = await setup()

      // item 3 is anna of tenant 2 - in tenant 1, there is an anna already
      await expect(users.patch(3, { tenantId: 1 })).rejects.toBeInstanceOf(
        Conflict,
      )
      // only the item, and only the id, the fields and those of where
      expect(find).toHaveBeenCalledOnce()
      expect(find).toHaveBeenCalledWith({
        query: { id: 3, $select: ['id', 'tenantId', 'email', 'deletedAt'] },
        paginate: false,
      })
    })
  })

  describe('multi patch', () => {
    it('finds duplicates it makes among its items', async () => {
      const { users } = await setup()

      await expect(
        users.patch(
          null,
          { email: 'same@x.de' },
          { query: { tenantId: 1, deletedAt: null } },
        ),
      ).rejects.toBeInstanceOf(Conflict)
    })

    it('throws for a duplicate of a stored item it does not change', async () => {
      const { users } = await setup()

      // moves anna of tenant 2 into tenant 1, which has an anna already
      await expect(
        users.patch(
          null,
          { tenantId: 1 },
          { query: { tenantId: 2, deletedAt: null } },
        ),
      ).rejects.toBeInstanceOf(Conflict)
    })

    it('moves items without a conflict', async () => {
      const { users } = await setup()

      await expect(
        users.patch(
          null,
          { tenantId: 7 },
          { query: { tenantId: 1, deletedAt: null } },
        ),
      ).resolves.toHaveLength(2)
    })

    it('checks a changed item against an unchanged one', async () => {
      const { users } = await setup()

      // anna keeps her email, ben gets it
      await expect(
        users.patch(
          null,
          { email: 'anna@x.de' },
          { query: { tenantId: 1, deletedAt: null } },
        ),
      ).rejects.toBeInstanceOf(Conflict)
    })
  })

  describe('where and null', () => {
    it('ignores stored items that do not match where', async () => {
      const { users } = await setup()

      await expect(
        users.create({ tenantId: 1, email: 'old@x.de', deletedAt: null }),
      ).resolves.toMatchObject({ email: 'old@x.de' })
    })

    it('does not check new items that do not match where', async () => {
      const { users, _find } = await setup()

      await users.create({ tenantId: 1, email: 'anna@x.de', deletedAt: 5 })

      expect(_find).not.toHaveBeenCalled()
    })

    it('checks a patch that makes an item match where', async () => {
      const { users } = await setup()

      // restores the deleted duplicate of anna
      await expect(users.patch(5, { deletedAt: null })).rejects.toBeInstanceOf(
        Conflict,
      )
    })

    it('does not check items with a null field, like a unique index', async () => {
      const { users } = await setup()

      await users.create({ tenantId: 1, email: null, deletedAt: null })
      await expect(
        users.create({ tenantId: 1, email: null, deletedAt: null }),
      ).resolves.toMatchObject({ email: null })
    })

    it('checks items with a null field with nullsNotDistinct', async () => {
      const { users } = await setup({
        fields: ['tenantId', 'email'],
        nullsNotDistinct: true,
      })

      await users.create({ tenantId: 1, email: null, deletedAt: null })
      await expect(
        users.create({ tenantId: 1, email: null, deletedAt: null }),
      ).rejects.toBeInstanceOf(Conflict)
    })
  })

  describe('query', () => {
    it('checks all items of a call with one query', async () => {
      const { users, _find } = await setup()

      await users.create([
        { tenantId: 5, email: 'a@x.de', deletedAt: null },
        { tenantId: 5, email: 'b@x.de', deletedAt: null },
      ])

      expect(_find).toHaveBeenCalledOnce()
      expect(_find.mock.calls[0]![0]!.query).toEqual({
        deletedAt: null,
        $or: [
          { tenantId: 5, email: 'a@x.de' },
          { tenantId: 5, email: 'b@x.de' },
        ],
        $select: ['id', 'tenantId', 'email'],
        $limit: 1,
      })
    })

    it('queries a single field with an equality or $in', async () => {
      const { users, _find } = await setup({ fields: 'email' })

      await users.create({ tenantId: 5, email: 'a@x.de', deletedAt: null }, {
        provider: 'rest',
        transaction: 'trx',
      } as any)
      await users.create([
        { tenantId: 5, email: 'b@x.de', deletedAt: null },
        { tenantId: 5, email: 'c@x.de', deletedAt: null },
      ])

      // the params of the call without its provider, e.g. for a transaction
      expect(_find.mock.calls[0]![0]).toEqual({
        transaction: 'trx',
        query: { email: 'a@x.de', $select: ['id', 'email'], $limit: 1 },
        paginate: false,
      })
      expect(_find.mock.calls[1]![0]!.query).toMatchObject({
        email: { $in: ['b@x.de', 'c@x.de'] },
      })
    })

    it('checks against all stored items, without the hooks of find', async () => {
      const { users } = await setup({ fields: 'email' })
      // a scope that hides every stored item from `find`
      users.hooks({
        before: {
          find: [
            (context: HookContext) => {
              context.params = { ...context.params, query: { tenantId: 999 } }
            },
          ],
        },
      })

      await expect(
        users.create({ tenantId: 9, email: 'ben@x.de', deletedAt: null }),
      ).rejects.toBeInstanceOf(Conflict)
    })

    it('queries through the hooks of the service with underscore: false', async () => {
      const { users } = await setup({ fields: 'email', underscore: false })
      // a scope that hides every stored item from `find`
      users.hooks({
        before: {
          find: [
            (context: HookContext) => {
              context.params = { ...context.params, query: { tenantId: 999 } }
            },
          ],
        },
      })

      // ben@x.de exists, but the scope hides it
      await expect(
        users.create({ tenantId: 9, email: 'ben@x.de', deletedAt: null }),
      ).resolves.toMatchObject({ email: 'ben@x.de' })
    })

    it('falls back to find for a service without _find', async () => {
      const service = {
        find: vi.fn(async () => [{ id: 9 }]),
        create: async (data: any) => data,
      }

      await expect(
        runHook(unique({ fields: 'email' }), {
          type: 'before',
          method: 'create',
          data: { email: 'a@x.de' },
          service,
        }),
      ).rejects.toBeInstanceOf(Conflict)
      expect(service.find).toHaveBeenCalledOnce()
    })
  })

  describe('error', () => {
    const setupWithError = async () => {
      const error = vi.fn(
        (_conflict: UniqueConflict<User>, _context: HookContext) =>
          new BadRequest('taken'),
      )
      const app = await setup({
        fields: ['tenantId', 'email'],
        where: { deletedAt: null },
        error,
      })
      return { ...app, error }
    }

    it('throws its error, with the item and the stored one it conflicts with', async () => {
      const { users, error } = await setupWithError()

      await expect(
        users.create({ tenantId: 1, email: 'ben@x.de', deletedAt: null }),
      ).rejects.toThrow(new BadRequest('taken'))

      expect(error).toHaveBeenCalledWith(
        {
          item: {
            id: undefined,
            data: { tenantId: 1, email: 'ben@x.de', deletedAt: null },
          },
          existing: {
            id: 2,
            data: { tenantId: 1, email: 'ben@x.de' },
            stored: true,
          },
        },
        expect.objectContaining({ method: 'create' }),
      )
    })

    it('tells which item of a multi create conflicts', async () => {
      const { users, error } = await setupWithError()

      await users
        .create([
          { tenantId: 5, email: 'new@x.de', deletedAt: null },
          { tenantId: 1, email: 'ben@x.de', deletedAt: null },
        ])
        .catch(() => {})

      expect(error.mock.calls[0]![0]).toMatchObject({
        item: { data: { tenantId: 1, email: 'ben@x.de' } },
        existing: { id: 2, stored: true },
      })
    })

    it('passes the other item for a conflict within the call', async () => {
      const { users, error } = await setupWithError()

      await users
        .patch(
          null,
          { email: 'same@x.de' },
          { query: { tenantId: 1, deletedAt: null } },
        )
        .catch(() => {})

      expect(error.mock.calls[0]![0]).toEqual({
        item: {
          id: 2,
          data: { tenantId: 1, email: 'same@x.de', deletedAt: null },
        },
        existing: {
          id: 1,
          data: { tenantId: 1, email: 'same@x.de', deletedAt: null },
          stored: false,
        },
      })
    })

    it('keeps the id of a stored item out of the default error', async () => {
      const { users } = await setup()

      const error = await users
        .create({ tenantId: 1, email: 'ben@x.de', deletedAt: null })
        .catch((error) => error)

      expect(error.data).toEqual({ fields: ['tenantId', 'email'] })
    })
  })

  it('works as an around hook', async () => {
    const app = feathers<{ users: MemoryService<User> }>()
    app.use('users', new MemoryService<User>({ startId: 1 }))
    const users = app.service('users')
    users.hooks({ around: { create: [unique({ fields: 'email' })] } })

    await users.create({ tenantId: 1, email: 'a@x.de', deletedAt: null })
    await expect(
      users.create({ tenantId: 1, email: 'a@x.de', deletedAt: null }),
    ).rejects.toBeInstanceOf(Conflict)
  })

  it('throws for an operator in where', () => {
    expect(() =>
      unique({ fields: 'email', where: { deletedAt: { $ne: null } } }),
    ).toThrow("'deletedAt' of where is an operator")
  })

  it('throws outside before and around hooks, and for other methods', async () => {
    const hook = unique({ fields: 'email' })

    await expect(
      runHook(hook, { type: 'after', method: 'create', data: {} }),
    ).rejects.toThrow("The 'unique' hook has invalid context")
    await expect(
      runHook(hook, { type: 'before', method: 'find' }),
    ).rejects.toThrow("The 'unique' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const data = await expectNoSideEffects(
      {
        params: { query: { $select: ['id'] }, user: { id: 1 } },
        data: { tenantId: 5, email: 'new@x.de', deletedAt: null },
      },
      async ({ params, data }) => {
        const service = new MemoryService<User>({ multi: true, startId: 1 })
        await service.create(seed)

        const context = await runHook(
          unique({ fields: ['tenantId', 'email'], where: { deletedAt: null } }),
          { type: 'before', method: 'create', data, params, service },
        )
        return context.data
      },
    )

    expect(data).toEqual({ tenantId: 5, email: 'new@x.de', deletedAt: null })
  })
})
