import { expect, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import type {
  Application,
  HookContext,
  Params,
  Query,
} from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { onDelete } from './on-delete.hook.js'
import type { OnDeleteOptions } from './on-delete.hook.js'

const mockApp = () => {
  const app = feathers()

  app.use('users', new MemoryService({ startId: 1, multi: true }))
  app.use('todos', new MemoryService({ startId: 1, multi: true }))
  app.use('tasks', new MemoryService({ startId: 1, multi: true }))

  const usersService = app.service('users')
  const todosService = app.service('todos')
  const tasksService = app.service('tasks')

  return {
    app,
    todosService,
    usersService,
    tasksService,
  }
}

describe('onDelete', function () {
  describe('cascade', function () {
    it('removes single item for single item', async function () {
      const { usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      const user = await usersService.create({
        name: 'John Doe',
      })

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: user.id,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([{ id: 2, title: 'Buy eggs', userId: 2 }])
    })

    it('removes multiple items for single item', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      const user = await usersService.create({
        name: 'John Doe',
      })

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: user.id,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: user.id,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([{ id: 3, title: 'Buy bread', userId: 3 }])
    })

    it('removes single item for multiple items', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 1,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(1)

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([
        { id: 2, name: 'Jane Doe' },
        { id: 3, name: 'Jack Doe' },
      ])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 2, title: 'Buy eggs', userId: 2 },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })

    it('removes multiple items for multiple items', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 1,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(null, { query: { id: { $in: [1, 2] } } })

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([{ id: 3, name: 'Jack Doe' }])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([{ id: 3, title: 'Buy bread', userId: 3 }])
    })

    it('does not remove items if not found', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 2,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(1)

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([
        { id: 2, name: 'Jane Doe' },
        { id: 3, name: 'Jack Doe' },
      ])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: 2 },
        { id: 2, title: 'Buy eggs', userId: 2 },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })

    it('can pass an array', async function () {
      const { app, usersService, todosService, tasksService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete([
              {
                service: 'todos',
                keyThere: 'userId',
                keyHere: 'id',
                onDelete: 'cascade',
                blocking: true,
              },
              {
                service: 'tasks',
                keyThere: 'userId',
                keyHere: 'id',
                onDelete: 'cascade',
                blocking: true,
              },
            ]),
          ],
        },
      })

      const user = await usersService.create({
        name: 'John Doe',
      })

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: user.id,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const task = await tasksService.create({
        title: 'Buy milk task',
        userId: user.id,
      })

      const task2 = await tasksService.create({
        title: 'Buy eggs task',
        userId: 2,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })
      expect(todos).toStrictEqual([{ id: 2, title: 'Buy eggs', userId: 2 }])

      const tasks = await tasksService.find({ query: {} })
      expect(tasks).toStrictEqual([
        { id: 2, title: 'Buy eggs task', userId: 2 },
      ])
    })
  })

  describe('set null', function () {
    it('sets null single item for single item', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'set null',
              blocking: true,
            }),
          ],
        },
      })

      const user = await usersService.create({
        name: 'John Doe',
      })

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: user.id,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: null },
        { id: 2, title: 'Buy eggs', userId: 2 },
      ])
    })

    it('sets null multiple items for single item', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'set null',
              blocking: true,
            }),
          ],
        },
      })

      const user = await usersService.create({
        name: 'John Doe',
      })

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: user.id,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: user.id,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: null },
        { id: 2, title: 'Buy eggs', userId: null },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })

    it('sets null single item for multiple items', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'set null',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 1,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(1)

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([
        { id: 2, name: 'Jane Doe' },
        { id: 3, name: 'Jack Doe' },
      ])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: null },
        { id: 2, title: 'Buy eggs', userId: 2 },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })

    it('sets null multiple items for multiple items', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'set null',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 1,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(null, { query: { id: { $in: [1, 2] } } })

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([{ id: 3, name: 'Jack Doe' }])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: null },
        { id: 2, title: 'Buy eggs', userId: null },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })

    it('does not set null for items if not found', async function () {
      const { app, usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
            }),
          ],
        },
      })

      await usersService.create([
        { name: 'John Doe' },
        { name: 'Jane Doe' },
        { name: 'Jack Doe' },
      ])

      const todo = await todosService.create({
        title: 'Buy milk',
        userId: 2,
      })

      const todo2 = await todosService.create({
        title: 'Buy eggs',
        userId: 2,
      })

      const todo3 = await todosService.create({
        title: 'Buy bread',
        userId: 3,
      })

      await usersService.remove(1)

      const users = await usersService.find({ query: {} })

      expect(users).toStrictEqual([
        { id: 2, name: 'Jane Doe' },
        { id: 3, name: 'Jack Doe' },
      ])

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: 2 },
        { id: 2, title: 'Buy eggs', userId: 2 },
        { id: 3, title: 'Buy bread', userId: 3 },
      ])
    })
  })

  describe('query', function () {
    it('cascade with query only removes matching items', async function () {
      const { usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'cascade',
              blocking: true,
              query: { completed: true },
            }),
          ],
        },
      })

      const user = await usersService.create({ name: 'John Doe' })

      await todosService.create({
        title: 'Buy milk',
        userId: user.id,
        completed: true,
      })
      await todosService.create({
        title: 'Buy eggs',
        userId: user.id,
        completed: false,
      })
      await todosService.create({
        title: 'Buy bread',
        userId: 2,
        completed: true,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 2, title: 'Buy eggs', userId: 1, completed: false },
        { id: 3, title: 'Buy bread', userId: 2, completed: true },
      ])
    })

    it('set null with query only patches matching items', async function () {
      const { usersService, todosService } = mockApp()

      usersService.hooks({
        after: {
          remove: [
            onDelete({
              service: 'todos',
              keyThere: 'userId',
              keyHere: 'id',
              onDelete: 'set null',
              blocking: true,
              query: { completed: true },
            }),
          ],
        },
      })

      const user = await usersService.create({ name: 'John Doe' })

      await todosService.create({
        title: 'Buy milk',
        userId: user.id,
        completed: true,
      })
      await todosService.create({
        title: 'Buy eggs',
        userId: user.id,
        completed: false,
      })

      await usersService.remove(user.id)

      const todos = await todosService.find({ query: {} })

      expect(todos).toStrictEqual([
        { id: 1, title: 'Buy milk', userId: null, completed: true },
        { id: 2, title: 'Buy eggs', userId: 1, completed: false },
      ])
    })
  })

  describe('types', function () {
    interface TodoResult {
      id: number
      title: string
      userId: number
      completed: boolean
    }

    interface TodoQuery {
      completed?: boolean
      userId?: number
    }

    type TodoService = MemoryService<
      TodoResult,
      Partial<TodoResult>,
      Params<TodoQuery>
    >
    type UserService = MemoryService

    interface AppServices {
      todos: TodoService
      users: UserService
    }

    type App = Application<AppServices>

    it('service is typed to keyof services', function () {
      expectTypeOf<
        OnDeleteOptions<App>['service']
      >().toEqualTypeOf<keyof AppServices & string>()
    })

    it('query is typed based on service path', function () {
      type TodoOptions = OnDeleteOptions<App, 'todos'>
      // MemoryService has overloaded find, so query resolves to
      // TodoQuery | Query | undefined (union of both overloads)
      expectTypeOf<TodoOptions['query']>().toEqualTypeOf<
        TodoQuery | Query | undefined
      >()
    })

    it('query accepts the custom query type', function () {
      type TodoOptions = OnDeleteOptions<App, 'todos'>
      expectTypeOf<{ completed: true }>().toMatchTypeOf<
        NonNullable<TodoOptions['query']>
      >()
    })

    it('onDelete accepts typed HookContext', function () {
      type AppHookContext = HookContext<App>

      const hook = onDelete<AppHookContext>({
        service: 'todos',
        keyThere: 'userId',
        keyHere: 'id',
        onDelete: 'cascade',
        query: { completed: true },
      })

      expectTypeOf(hook).toBeFunction()
    })

    it('onDelete accepts array with different services', function () {
      type AppHookContext = HookContext<App>

      const hook = onDelete<AppHookContext>([
        {
          service: 'todos',
          keyThere: 'userId',
          keyHere: 'id',
          onDelete: 'cascade',
          query: { completed: true },
        },
        {
          service: 'users',
          keyThere: 'createdBy',
          keyHere: 'id',
          onDelete: 'set null',
        },
      ])

      expectTypeOf(hook).toBeFunction()
    })
  })
})
