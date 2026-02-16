import { expect } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { createRelated } from './create-related.hook.js'

type MockAppOptions = {
  multi?: boolean
}

const defaultOptions = {
  multi: true,
}

const mockApp = (_options?: MockAppOptions) => {
  const options = Object.assign({}, defaultOptions, _options)
  const app = feathers()

  app.use('users', new MemoryService({ startId: 1, multi: true }))
  app.use('todos', new MemoryService({ startId: 1, multi: options.multi }))

  const usersService = app.service('users')
  const todosService = app.service('todos')

  return {
    app,
    todosService,
    usersService,
  }
}

type User = {
  id: number
  name: string
}

type Todo = {
  id: number
  title: string
  userId: number
}

const mockAppStronglyTyped = (_options?: MockAppOptions) => {
  const options = Object.assign({}, defaultOptions, _options)
  const app = feathers<{
    users: MemoryService<User>
    todos: MemoryService<Todo>
  }>()

  app.use('users', new MemoryService<User>({ startId: 1, multi: true }))
  app.use(
    'todos',
    new MemoryService<Todo>({ startId: 1, multi: options.multi }),
  )

  const usersService = app.service('users')
  const todosService = app.service('todos')

  return {
    app,
    todosService,
    usersService,
  }
}

describe('hook - createRelated (type tests)', function () {
  it('errors on wrong service name', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            // @ts-expect-error - 'nonexistent' is not a valid service name
            service: 'nonexistent',
            data: (item) => [{ title: 'test', userId: item.id }],
          }),
        ],
      },
    })
  })

  it('item in data function is properly typed', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item) => {
              const name: string = item.name
              // @ts-expect-error - 'nonExistentProp' does not exist on User
              const bad = item.nonExistentProp
              return [{ title: name, userId: item.id }]
            },
          }),
        ],
      },
    })
  })

  it('data can return a single object', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item) => ({ title: 'test', userId: item.id }),
          }),
        ],
      },
    })
  })

  it('data can return an array', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item) => [
              { title: 'test1', userId: item.id },
              { title: 'test2', userId: item.id },
            ],
          }),
        ],
      },
    })
  })

  it('data return type must match target service', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            // @ts-expect-error - wrong data shape for todos service
            data: (item) => [{ wrongField: 'test' }],
          }),
        ],
      },
    })
  })
})

describe('hook - createRelated', function () {
  it('creates single item for single item', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => ({
              title: 'First issue',
              userId: item.id,
            }),
          }),
        ],
      },
    })

    const user = await app.service('users').create({
      name: 'John Doe',
    })

    const todos = await todosService.find({ query: {} })

    expect(todos).toStrictEqual([{ id: 1, title: 'First issue', userId: 1 }])
  })

  it('can use context in data function', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => ({
              title: context.path,
              userId: item.id,
            }),
          }),
        ],
      },
    })

    const user = await app.service('users').create({
      name: 'John Doe',
    })

    const todos = await todosService.find({ query: {} })

    expect(todos).toStrictEqual([{ id: 1, title: 'users', userId: 1 }])
  })

  it('creates multiple items for multiple items', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => ({
              title: item.name,
              userId: item.id,
            }),
          }),
        ],
      },
    })

    const users = await app
      .service('users')
      .create([{ name: 'user1' }, { name: 'user2' }, { name: 'user3' }])

    const todos = await todosService.find({ query: { $sort: { userId: 1 } } })

    expect(todos).toStrictEqual([
      { id: 1, title: 'user1', userId: 1 },
      { id: 2, title: 'user2', userId: 2 },
      { id: 3, title: 'user3', userId: 3 },
    ])
  })

  it('creates multple items for multiple items with multi: false', async function () {
    const { app, todosService } = mockApp({ multi: false })

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => ({
              title: item.name,
              userId: item.id,
            }),
            multi: false,
          }),
        ],
      },
    })

    // @ts-expect-error - does not have options
    expect(todosService.options.multi).toBe(false)

    const users = await app
      .service('users')
      .create([{ name: 'user1' }, { name: 'user2' }, { name: 'user3' }])

    const todos = await todosService.find({ query: { $sort: { userId: 1 } } })

    expect(todos).toStrictEqual([
      { id: 1, title: 'user1', userId: 1 },
      { id: 2, title: 'user2', userId: 2 },
      { id: 3, title: 'user3', userId: 3 },
    ])
  })

  it('can create multiple data for one record', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => [
              {
                title: 1,
                userId: item.id,
              },
              {
                title: 2,
                userId: item.id,
              },
            ],
          }),
        ],
      },
    })

    const user = await app.service('users').create({
      name: 'John Doe',
    })

    const todos = await todosService.find({ query: {} })

    expect(todos).toStrictEqual([
      { id: 1, title: 1, userId: 1 },
      { id: 2, title: 2, userId: 1 },
    ])
  })

  it('creates multiple data for multiple records', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => [
              {
                title: `${item.name}-a`,
                userId: item.id,
              },
              {
                title: `${item.name}-b`,
                userId: item.id,
              },
            ],
          }),
        ],
      },
    })

    const users = await app
      .service('users')
      .create([{ name: 'user1' }, { name: 'user2' }])

    const todos = await todosService.find({ query: { $sort: { id: 1 } } })

    expect(todos).toStrictEqual([
      { id: 1, title: 'user1-a', userId: 1 },
      { id: 2, title: 'user1-b', userId: 1 },
      { id: 3, title: 'user2-a', userId: 2 },
      { id: 4, title: 'user2-b', userId: 2 },
    ])
  })

  it('can pass an array', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated([
            {
              service: 'todos',
              data: (item, context) => [
                {
                  title: 1,
                  userId: item.id,
                },
              ],
            },
            {
              service: 'todos',
              data: (item, context) => [
                {
                  title: 2,
                  userId: item.id,
                },
              ],
            },
          ]),
        ],
      },
    })

    const user = await app.service('users').create({
      name: 'John Doe',
    })

    const todos = await todosService.find({ query: {} })

    expect(todos).toStrictEqual([
      { id: 1, title: 1, userId: 1 },
      { id: 2, title: 2, userId: 1 },
    ])
  })

  it('does not create items if falsey', async function () {
    const { app, todosService } = mockApp()

    app.service('users').hooks({
      after: {
        create: [
          createRelated({
            service: 'todos',
            data: (item, context) => undefined,
          }),
        ],
      },
    })

    const user = await app.service('users').create({
      name: 'John Doe',
    })

    const todos = await todosService.find({ query: {} })

    expect(todos).toStrictEqual([])
  })
})
