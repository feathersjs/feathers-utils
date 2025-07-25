import type { Params } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { iterateFind } from './iterate-find.js'

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

describe('iterateFind', function () {
  it('basic usage', async function () {
    const { app } = await setup()

    const userNames = []

    for await (const user of iterateFind(app, 'users')) {
      userNames.push(user.name)
    }

    expect(userNames).toEqual(
      Array.from({ length: 100 }).map((_, i) => `test${i + 1}`),
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
      Array.from({ length: 80 }).map((_, i) => `test${i + 21}`),
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
})
