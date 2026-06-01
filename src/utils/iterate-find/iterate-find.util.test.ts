import type { Params } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { iterateFind } from './iterate-find.util.js'

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
})
