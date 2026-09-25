import { expect, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import type { HookContext, PaginationOptions } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { count } from './count.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

type Todo = {
  id: number
  title: string
  done: boolean
}

const mockApp = async (paginate?: PaginationOptions) => {
  const app = feathers<{ todos: MemoryService<Todo> }>()

  app.use(
    'todos',
    new MemoryService<Todo>({ startId: 1, multi: true, paginate }),
  )

  const todosService = app.service('todos')

  await todosService.create([
    { title: 'one', done: false },
    { title: 'two', done: true },
    { title: 'three', done: false },
  ] as any)

  const results: unknown[] = []

  todosService.hooks({
    after: {
      find: [
        (context: HookContext) => {
          results.push(context.result)
        },
      ],
    },
  })

  return { app, todosService, results }
}

describe('utils/count', function () {
  it('counts the items of a paginated service', async function () {
    const { app } = await mockApp({ default: 2, max: 2 })

    expect(await count(app, 'todos')).toBe(3)
    expect(await count(app, 'todos', { query: { done: false } })).toBe(2)
  })

  it('counts the items of a service without pagination', async function () {
    const { app } = await mockApp()

    expect(await count(app, 'todos')).toBe(3)
    expect(await count(app, 'todos', { query: { done: false } })).toBe(2)
  })

  it('counts despite `paginate: false` in params', async function () {
    const { app } = await mockApp({ default: 2, max: 2 })

    expect(await count(app, 'todos', { paginate: false })).toBe(3)
  })

  it('does not load any items', async function () {
    const { app, results } = await mockApp()

    await count(app, 'todos', { query: { done: false } })

    expect(results).toStrictEqual([{ total: 2, limit: 0, skip: 0, data: [] }])
  })

  it('ignores a `$limit` in the query', async function () {
    const { app } = await mockApp()

    expect(await count(app, 'todos', { query: { $limit: 1 } })).toBe(3)
  })

  it('returns 0 if nothing matches', async function () {
    const { app } = await mockApp()

    expect(await count(app, 'todos', { query: { title: 'four' } })).toBe(0)
  })

  it("throws if the service has no 'find' method", async function () {
    const app = feathers()
    app.use('todos', {
      async get() {
        return {}
      },
    } as any)

    await expect(count(app, 'todos')).rejects.toThrow(
      "Service 'todos' does not have a 'find' method.",
    )
  })

  it('throws if the service does not return a paginated result', async function () {
    const app = feathers()
    app.use('todos', {
      async find() {
        return []
      },
    })

    await expect(count(app, 'todos')).rejects.toThrow(
      "Service 'todos' did not return a paginated result, so its items cannot be counted.",
    )
  })

  it('returns a number', async function () {
    const { app } = await mockApp()

    expectTypeOf(count(app, 'todos')).toEqualTypeOf<Promise<number>>()
  })

  it('does not mutate params', async () => {
    const total = await expectNoSideEffects(
      { query: { done: false, $limit: 1 }, paginate: false as const },
      async (params) => {
        const { app } = await mockApp()
        return await count(app, 'todos', params)
      },
    )
    expect(total).toBe(2)
  })
})
