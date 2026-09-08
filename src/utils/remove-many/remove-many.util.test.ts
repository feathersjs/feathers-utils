import { expect, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import type { HookContext, Params } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { Multi } from '../../types.js'
import { removeMany } from './remove-many.util.js'

type Todo = {
  id: number
  title: string
  userId: number
}

const mockApp = (multi?: Multi) => {
  const app = feathers<{ todos: MemoryService<Todo> }>()

  app.use('todos', new MemoryService<Todo>({ startId: 1, multi: multi as any }))

  const todosService = app.service('todos')

  const calls: (number | string | null)[] = []

  todosService.hooks({
    before: {
      remove: [
        (context: HookContext) => {
          calls.push(context.id as number | null)
        },
      ],
    },
  })

  return { app, todosService, calls }
}

const seed = async (todosService: MemoryService<Todo>) => {
  // one by one, so seeding works for services that disallow multi
  await todosService.create({ title: 'one', userId: 1 } as any)
  await todosService.create({ title: 'two', userId: 1 } as any)
  await todosService.create({ title: 'three', userId: 2 } as any)
}

describe('utils/removeMany', function () {
  it('removes with a single multi call if the service allows multi', async function () {
    const { app, todosService, calls } = mockApp(true)
    await seed(todosService)

    const removed = await removeMany(app, 'todos', { query: { userId: 1 } })

    expect(removed).toStrictEqual([
      { id: 1, title: 'one', userId: 1 },
      { id: 2, title: 'two', userId: 1 },
    ])
    expect(calls).toStrictEqual([null])
    expect(await todosService.find({ query: {} })).toStrictEqual([
      { id: 3, title: 'three', userId: 2 },
    ])
  })

  it('removes one by one if the service does not allow multi', async function () {
    const { app, todosService, calls } = mockApp(false)
    await seed(todosService)

    const removed = await removeMany(app, 'todos', { query: { userId: 1 } })

    expect(removed).toStrictEqual([
      { id: 1, title: 'one', userId: 1 },
      { id: 2, title: 'two', userId: 1 },
    ])
    expect(calls).toStrictEqual([1, 2])
    expect(await todosService.find({ query: {} })).toStrictEqual([
      { id: 3, title: 'three', userId: 2 },
    ])
  })

  it('removes one by one if the method is not in the multi option', async function () {
    const { app, todosService, calls } = mockApp(['patch'])
    await seed(todosService)

    await removeMany(app, 'todos', { query: { userId: 1 } })

    expect(calls).toStrictEqual([1, 2])
    expect(await todosService.find({ query: {} })).toStrictEqual([
      { id: 3, title: 'three', userId: 2 },
    ])
  })

  it('prefers an explicit multi option over the service option', async function () {
    const { app, todosService, calls } = mockApp(true)
    await seed(todosService)

    await removeMany(app, 'todos', { query: { userId: 1 } }, { multi: false })

    expect(calls).toStrictEqual([1, 2])
    expect(await todosService.find({ query: {} })).toStrictEqual([
      { id: 3, title: 'three', userId: 2 },
    ])
  })

  it('assumes multi for services that do not declare it', async function () {
    const app = feathers()
    const calls: any[] = []

    app.use('todos', {
      async find() {
        throw new Error('should not be called')
      },
      async remove(id: any, params: any) {
        calls.push([id, params])
        return [{ id: 1 }]
      },
    } as any)

    const removed = await removeMany(app, 'todos', { query: { userId: 1 } })

    expect(removed).toStrictEqual([{ id: 1 }])
    expect(calls).toStrictEqual([
      [null, { query: { userId: 1 }, paginate: false }],
    ])
  })

  it('returns an empty array if nothing matches', async function () {
    const { app, todosService, calls } = mockApp(false)
    await seed(todosService)

    expect(await removeMany(app, 'todos', { query: { userId: 99 } })).toEqual(
      [],
    )
    expect(calls).toStrictEqual([])
    expect(await todosService.find({ query: {} })).toHaveLength(3)
  })

  it('does not apply the query again for the per-item calls', async function () {
    const { app, todosService, calls } = mockApp(false)
    await seed(todosService)

    const queries: (Params['query'] | undefined)[] = []

    todosService.hooks({
      before: {
        remove: [
          (context: HookContext) => {
            queries.push(context.params.query)
          },
        ],
      },
    })

    // the query is consumed by the `find` - a per-item `remove` must not
    // re-check it, or a stale item throws `NotFound` and takes the whole
    // call down with it
    const removed = await removeMany(app, 'todos', {
      query: { userId: 1, $sort: { id: -1 }, $limit: 10, $skip: 0 },
    })

    // `$sort`/`$limit`/`$skip` still shape the `find`
    expect(removed).toStrictEqual([
      { id: 2, title: 'two', userId: 1 },
      { id: 1, title: 'one', userId: 1 },
    ])
    expect(calls).toStrictEqual([2, 1])
    expect(queries).toStrictEqual([undefined, undefined])
  })

  it('keeps $select for the per-item calls', async function () {
    const { app, todosService, calls } = mockApp(false)
    await seed(todosService)

    const removed = await removeMany(app, 'todos', {
      query: { userId: 1, $select: ['title'] },
    })

    // `$select` is dropped for the `find`, so the id is always there
    expect(calls).toStrictEqual([1, 2])
    expect(removed).toStrictEqual([
      { id: 1, title: 'one' },
      { id: 2, title: 'two' },
    ])
  })

  it('only selects the id property for the find', async function () {
    const { app, todosService } = mockApp(false)
    await seed(todosService)

    const findQueries: (Params['query'] | undefined)[] = []

    todosService.hooks({
      before: {
        find: [
          (context: HookContext) => {
            findQueries.push(context.params.query)
          },
        ],
      },
    })

    await removeMany(app, 'todos', { query: { userId: 1, $select: ['title'] } })

    // the `find` only collects the ids
    expect(findQueries).toStrictEqual([{ userId: 1, $select: ['id'] }])
  })

  it("throws if the service has no 'remove' method", async function () {
    const app = feathers()
    app.use('todos', {
      async find() {
        return []
      },
    } as any)

    await expect(removeMany(app, 'todos')).rejects.toThrow(
      "Service 'todos' does not have a 'remove' method.",
    )
  })

  it('infers the item type', async function () {
    const { app } = mockApp(true)

    const removed = await removeMany(app, 'todos', { query: { userId: 1 } })

    expectTypeOf(removed).toEqualTypeOf<Todo[]>()
  })
})
