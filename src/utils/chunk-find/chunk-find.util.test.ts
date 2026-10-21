import type { Params } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { chunkFind } from './chunk-find.util.js'
import { expectNoSideEffects } from '../../testing/index.js'

type User = {
  id: number
  name: string
}

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
        max: 100,
      },
    }),
  )

  const usersService = app.service('users')

  for (let i = 1; i <= 100; i++) {
    await usersService.create({ name: `test${i}` })
  }

  return { app, usersService }
}

describe('chunkFind', function () {
  it('basic usage', async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users')) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(10)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[0]![0]!.name).toBe('test1')
    expect(chunks[9]![9]!.name).toBe('test100')
  })

  it('can skip items', async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users', {
      params: { query: { $skip: 20 } },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(8)
    expect(chunks[0]![0]!.name).toBe('test21')
  })

  it('can set chunk size via $limit', async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users', {
      params: { query: { $limit: 25 } },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(4)
    expect(chunks[0]).toHaveLength(25)
    expect(chunks[3]).toHaveLength(25)
  })

  it('can query for items', async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users', {
      params: { query: { name: 'test1' } },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual([expect.objectContaining({ name: 'test1' })])
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
          // empty page while total still claims more -> must break, not loop forever
          return { data: [], total: 100, limit: 10, skip: params.query.$skip }
        },
      }),
    } as any

    const chunks: any[] = []
    for await (const chunk of chunkFind<{ users: any }, 'users'>(
      fakeApp,
      'users',
    )) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(calls).toBeLessThanOrEqual(2)
  }, 2000)

  it('ignores paginate:false and always paginates', async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users', {
      params: { query: { name: 'test1' }, paginate: false },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual([expect.objectContaining({ name: 'test1' })])
  })

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
        for await (const value of chunkFind(app, 'items', { params })) {
          yielded.push(value)
        }

        return find.mock.calls.map(([params]: any[]) => params.query.$skip)
      },
    )
    expect(skips).toEqual([0, 2])
  })

  describe('keyset', () => {
    it('yields the pages of `$limit`, sorted by id', async function () {
      const app = feathers().use(
        'items',
        new MemoryService({ startId: 1, multi: true }),
      )
      await app.service('items').create(Array.from({ length: 25 }, () => ({})))

      const pages: number[][] = []
      for await (const page of chunkFind(app, 'items', {
        params: { query: { $limit: 10 } },
        keyset: true,
      })) {
        pages.push(page.map((item: any) => item.id))
      }

      expect(pages.map((page) => page.length)).toEqual([10, 10, 5])
      expect(pages.flat()).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
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
      for await (const page of chunkFind(app, 'jobs', {
        params: { query: { status: 'pending' } },
        keyset: true,
      })) {
        processed += page.length
        await jobs.patch(
          null,
          { status: 'done' },
          { query: { id: { $in: page.map((job: any) => job.id) } } },
        )
      }

      expect(processed).toBe(50)
    })
  })
})
