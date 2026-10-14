import type { Params } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { iterateFind } from './iterate-find.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

type User = {
  id: number
  name: string
}

const length = 1000
const max = 100

const setup = async () => {
  const app = feathers<{
    users: MemoryService<
      User,
      Partial<User>,
      Params<{ id: number; name: string }>
    >
  }>()

  app.use(
    'users',
    new MemoryService({
      id: 'id',
      startId: 1,
      multi: true,
      paginate: {
        default: 10,
        max,
      },
    }),
  )

  const usersService = app.service('users')

  const usersToCreate = Array.from({ length }).map((_, i) => ({
    name: `test${i + 1}`,
  }))

  await usersService.create(usersToCreate)

  return { app, usersService }
}

describe('iterateFind', function () {
  it('basic usage', async function () {
    const { app } = await setup()

    const userNames = []

    for await (const user of iterateFind(app, 'users')) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(
      Array.from({ length }).map((_, i) => `test${i + 1}`),
    )
  })

  it('can skip items', async function () {
    const { app } = await setup()

    const userNames = []

    for await (const user of iterateFind(app, 'users', {
      params: { query: { $skip: 20 } },
    })) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(
      Array.from({ length: length - 20 }).map((_, i) => `test${i + 21}`),
    )
  })

  it('can query for items', async function () {
    const { app } = await setup()

    const userNames = []

    for await (const user of iterateFind(app, 'users', {
      params: { query: { name: 'test1' } },
    })) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(['test1'])
  })

  it('ignores paginate:false and always paginates', async function () {
    const { app } = await setup()

    const userNames = []

    for await (const user of iterateFind(app, 'users', {
      params: { query: { name: 'test1' }, paginate: false },
    })) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(['test1'])
  })

  it('works with max', async function () {
    const { app } = await setup()

    expect(max + 10).toBeLessThan(length)

    const userNames = []

    for await (const user of iterateFind(app, 'users', {
      params: { query: { $limit: max + 10 } },
    })) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(
      Array.from({ length }).map((_, i) => `test${i + 1}`),
    )
  })

  it('terminates on an empty page even if total stays high (stale total)', async function () {
    let calls = 0
    const fakeApp = {
      service: () => ({
        find: async (params: any) => {
          calls++
          if (params.query.$skip === 0) {
            return {
              data: [{ id: 1, name: 'a' }],
              total: 100,
              limit: 10,
              skip: 0,
            }
          }
          return { data: [], total: 100, limit: 10, skip: params.query.$skip }
        },
      }),
    } as any

    const items: any[] = []
    for await (const item of iterateFind<{ users: any }, 'users'>(
      fakeApp,
      'users',
    )) {
      items.push(item)
    }

    expect(items).toHaveLength(1)
    expect(calls).toBeLessThanOrEqual(2)
  }, 2000)

  it('does not mutate params, and hands every page its own', async () => {
    const skips = await expectNoSideEffects(
      { query: { $limit: 2 } },
      async (params) => {
        const app = feathers().use('items', new MemoryService({ multi: true }))
        await app
          .service('items')
          .create([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
        const find = vi.spyOn(app.service('items'), 'find')

        const yielded: unknown[] = []
        for await (const value of iterateFind(app, 'items', { params })) {
          yielded.push(value)
        }

        return find.mock.calls.map(([params]: any[]) => params.query.$skip)
      },
    )
    expect(skips).toEqual([0, 2])
  })

  describe('keyset', () => {
    it('yields every item, sorted by id', async function () {
      const { app } = await setup()

      const ids: number[] = []
      for await (const user of iterateFind(app, 'users', { keyset: true })) {
        ids.push(user.id)
      }

      expect(ids).toEqual(Array.from({ length }, (_, i) => i + 1))
    })

    it('yields every item when the loop changes them out of the query', async function () {
      const app = feathers().use(
        'jobs',
        new MemoryService({ startId: 1, multi: true }),
      )
      const jobs = app.service('jobs')
      await jobs.create(
        Array.from({ length: 50 }, () => ({ status: 'pending' })),
      )

      let processed = 0
      for await (const job of iterateFind(app, 'jobs', {
        params: { query: { status: 'pending' } },
        keyset: true,
      })) {
        processed++
        await jobs.patch((job as any).id, { status: 'done' })
      }

      expect(processed).toBe(50)
      expect(
        await jobs.find({ query: { status: 'pending' }, paginate: false }),
      ).toEqual([])
    })

    it('finds pages of `$limit`, capped by `max`, without `paginate`', async function () {
      const { app } = await setup()
      const calls: any[] = []
      app.service('users').hooks({
        before: { find: [(context) => void calls.push(context.params)] },
      })

      let count = 0
      for await (const _ of iterateFind(app, 'users', {
        params: { query: { $limit: max + 10 } },
        keyset: true,
      })) {
        count++
      }

      expect(count).toBe(length)
      expect(calls).toHaveLength(length / max + 1)
      expect(calls[0].query.$limit).toBe(max)
      expect(calls[0].paginate).toBe(false)
    })

    it('keeps a condition on the id', async function () {
      const { app } = await setup()

      const ids: number[] = []
      for await (const user of iterateFind(app, 'users', {
        params: { query: { id: { $lte: 25 } } },
        keyset: true,
      })) {
        ids.push(user.id)
      }

      expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    })

    it('starts after `$skip`', async function () {
      const { app } = await setup()

      const ids: number[] = []
      for await (const user of iterateFind(app, 'users', {
        params: { query: { $skip: length - 15 } },
        keyset: true,
      })) {
        ids.push(user.id)
      }

      expect(ids).toEqual(Array.from({ length: 15 }, (_, i) => length - 14 + i))
    })

    it('adds the id to a `$select` that leaves it out', async function () {
      const { app } = await setup()

      const users: any[] = []
      for await (const user of iterateFind(app, 'users', {
        params: { query: { $select: ['name'], id: { $lte: 15 } } },
        keyset: true,
      })) {
        users.push(user)
      }

      expect(users).toHaveLength(15)
      expect(users[14]).toEqual({ id: 15, name: 'test15' })
    })

    it('throws for a `$sort`', async function () {
      const { app } = await setup()

      const run = async () => {
        for await (const _ of iterateFind(app, 'users', {
          params: { query: { $sort: { name: 1 } } },
          keyset: true,
        })) {
          // never reached
        }
      }

      await expect(run()).rejects.toThrow(/can't take a \$sort/)
    })

    it('throws instead of looping when a page does not advance', async function () {
      // ignores the query: hands out the same page again and again
      const fakeApp = {
        service: () => ({ find: async () => [{ id: 1 }, { id: 2 }] }),
      } as any

      const run = async () => {
        for await (const _ of iterateFind<{ users: any }, 'users'>(
          fakeApp,
          'users',
          { keyset: true },
        )) {
          // drained
        }
      }

      await expect(run()).rejects.toThrow(/made no progress/)
    })

    it('does not mutate params, the `$select` it extends included', async () => {
      // a nested condition can't be frozen here: the memory adapter writes into it
      const ids = await expectNoSideEffects(
        { query: { $limit: 2, $select: ['name'] } },
        async (params) => {
          const app = feathers().use(
            'items',
            new MemoryService({ startId: 1, multi: true }),
          )
          await app
            .service('items')
            .create([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
          const ids: number[] = []
          for await (const item of iterateFind(app, 'items', {
            params,
            keyset: true,
          })) {
            ids.push((item as any).id)
          }
          return ids
        },
      )
      expect(ids).toEqual([1, 2, 3])
    })
  })
})
