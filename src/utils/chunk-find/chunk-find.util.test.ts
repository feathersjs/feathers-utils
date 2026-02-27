import type { Params } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { chunkFind } from './chunk-find.util.js'

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

  it("ignores paginate:false and always paginates", async function () {
    const { app } = await setup()

    const chunks = []

    for await (const chunk of chunkFind(app, 'users', {
      params: { query: { name: 'test1' }, paginate: false },
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toEqual([expect.objectContaining({ name: 'test1' })])
  });
})
