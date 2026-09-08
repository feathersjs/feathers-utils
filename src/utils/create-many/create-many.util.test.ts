import { expect, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import type { HookContext } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { Multi } from '../../types.js'
import { createMany } from './create-many.util.js'

type Todo = {
  id: number
  title: string
  userId: number
}

const mockApp = (multi?: Multi) => {
  const app = feathers<{ todos: MemoryService<Todo> }>()

  app.use('todos', new MemoryService<Todo>({ startId: 1, multi: multi as any }))

  const todosService = app.service('todos')

  const calls: any[] = []

  todosService.hooks({
    before: {
      create: [
        (context: HookContext) => {
          calls.push(context.data)
        },
      ],
    },
  })

  return { app, todosService, calls }
}

const data = [
  { title: 'one', userId: 1 },
  { title: 'two', userId: 1 },
] as any[]

describe('utils/createMany', function () {
  it('creates with a single multi call if the service allows multi', async function () {
    const { app, calls } = mockApp(true)

    const created = await createMany(app, 'todos', data)

    expect(created).toStrictEqual([
      { id: 1, title: 'one', userId: 1 },
      { id: 2, title: 'two', userId: 1 },
    ])
    expect(calls).toStrictEqual([data])
  })

  it('creates one by one if the service does not allow multi', async function () {
    const { app, calls } = mockApp(false)

    const created = await createMany(app, 'todos', data)

    expect(created).toStrictEqual([
      { id: 1, title: 'one', userId: 1 },
      { id: 2, title: 'two', userId: 1 },
    ])
    expect(calls).toStrictEqual([data[0], data[1]])
  })

  it('creates one by one if the method is not in the multi option', async function () {
    const { app, calls } = mockApp(['patch'])

    await createMany(app, 'todos', data)

    expect(calls).toStrictEqual([data[0], data[1]])
  })

  it('prefers an explicit multi option over the service option', async function () {
    const { app, calls } = mockApp(true)

    await createMany(app, 'todos', data, { multi: false })

    expect(calls).toStrictEqual([data[0], data[1]])
  })

  it('creates a single item with a single call, even without multi', async function () {
    const { app, calls } = mockApp(false)

    const created = await createMany(app, 'todos', [data[0]])

    expect(created).toStrictEqual([{ id: 1, title: 'one', userId: 1 }])
    expect(calls).toStrictEqual([data[0]])
  })

  it('assumes multi for services that do not declare it', async function () {
    const app = feathers()
    const calls: any[] = []

    app.use('todos', {
      async create(createData: any) {
        calls.push(createData)
        return createData
      },
    } as any)

    const created = await createMany(app, 'todos', data)

    expect(created).toStrictEqual(data)
    expect(calls).toStrictEqual([data])
  })

  it('returns an empty array for no data', async function () {
    const { app, calls } = mockApp(true)

    expect(await createMany(app, 'todos', [])).toEqual([])
    expect(calls).toStrictEqual([])
  })

  it("throws if the service has no 'create' method", async function () {
    const app = feathers()
    app.use('todos', {
      async find() {
        return []
      },
    } as any)

    await expect(createMany(app, 'todos', [{} as any])).rejects.toThrow(
      "Service 'todos' does not have a 'create' method.",
    )
  })

  it('infers the item type', async function () {
    const { app } = mockApp(true)

    const created = await createMany(app, 'todos', data)

    expectTypeOf(created).toEqualTypeOf<Todo[]>()
  })
})
