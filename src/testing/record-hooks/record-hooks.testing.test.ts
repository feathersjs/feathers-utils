import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { isContext } from '../../predicates/index.js'
import { recordHooks } from './record-hooks.testing.js'

type User = {
  id: number
  name: string
}

const setup = () => {
  const app = feathers<{
    users: MemoryService<User, Partial<User>>
    todos: MemoryService<User, Partial<User>>
  }>()

  app.use('users', new MemoryService({ id: 'id', startId: 1, multi: true }))
  app.use('todos', new MemoryService({ id: 'id', startId: 1, multi: true }))

  return { app, users: app.service('users'), todos: app.service('todos') }
}

describe('recordHooks', function () {
  it('records calls per hook type and method', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    expect(calls.before.find).toHaveLength(0)
    expect(calls.before.create).toHaveLength(0)

    await users.create({ name: 'jane' })
    await users.find({ query: { name: 'jane' } })
    await users.find({})

    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.find).toHaveLength(2)
    expect(calls.before.remove).toHaveLength(0)
    expect(calls.before.find[0].params.query).toEqual({ name: 'jane' })

    // only the type that was recorded in fills up
    expect(calls.after.create).toHaveLength(0)
    expect(calls.error.create).toHaveLength(0)
    expect(calls.around.create).toHaveLength(0)
  })

  it('reads unrecorded methods as `[]` and lists only recorded ones', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })

    expect(calls.before.get).toEqual([])
    expect(calls.before.aCustomMethod).toEqual([])
    expect(calls.after.create).toEqual([])

    expect(Object.keys(calls.before)).toEqual(['create'])
    expect(Object.keys(calls.after)).toEqual([])
  })

  it('collects every call in order in `all`', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const user = await users.create({ name: 'jane' })
    await users.patch(user.id, { name: 'changed' })
    await users.remove(user.id)

    expect(calls.all.map((context) => context.method)).toEqual([
      'create',
      'patch',
      'remove',
    ])
  })

  it('composes with `isContext` on any recorded list', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app, { type: ['before', 'after'] })

    await users.create({ name: 'jane' })
    await todos.find({})
    await todos.find({})

    expect(calls.all.filter(isContext({ path: 'users' }))).toHaveLength(2)
    expect(calls.before.find.filter(isContext({ path: 'todos' }))).toHaveLength(
      2,
    )
    expect(
      calls.all.filter(isContext({ path: 'todos', type: 'after' })),
    ).toHaveLength(2)
    expect(
      calls.all.filter(isContext({ method: ['create', 'find'] })),
    ).toHaveLength(6)
    expect(calls.all.filter(isContext({ path: 'nope' }))).toHaveLength(0)
  })

  it('records every service of an app, including ones registered later', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app)

    ;(app as any).use('late', new MemoryService({ id: 'id', startId: 1 }))

    await users.create({ name: 'jane' })
    await todos.create({ name: 'todo' })
    await (app as any).service('late').create({ name: 'late' })

    expect(calls.before.create).toHaveLength(3)
    expect(calls.all.map((context) => context.path)).toEqual([
      'users',
      'todos',
      'late',
    ])
  })

  it('records a single service only', async function () {
    const { users, todos } = setup()
    const calls = recordHooks(users)

    await users.create({ name: 'jane' })
    await todos.create({ name: 'todo' })

    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.create[0].path).toBe('users')
  })

  it('reset() empties the record but keeps recording', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })
    expect(calls.all).toHaveLength(1)

    calls.reset()

    expect(calls.all).toHaveLength(0)
    expect(calls.before.create).toHaveLength(0)
    expect(Object.keys(calls.before)).toEqual([])

    await users.create({ name: 'john' })
    expect(calls.before.create).toHaveLength(1)
  })

  it('reset() forgets only what its predicate matches', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app, { type: ['before', 'after'] })

    await users.create({ name: 'jane' })
    await todos.create({ name: 'todo' })
    await todos.find({})

    calls.reset(isContext({ path: 'todos', method: 'create' }))

    expect(calls.all).toHaveLength(4)
    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.create[0].path).toBe('users')
    expect(calls.before.find).toHaveLength(1)
    expect(calls.after.create).toHaveLength(1)

    // the recorded type is matchable too, because it stays on the context
    calls.reset(isContext({ type: 'after' }))

    expect(calls.all).toHaveLength(2)
    expect(calls.after.create).toHaveLength(0)
    expect(calls.before.create).toHaveLength(1)
  })

  it('reset() takes any predicate, not just `isContext`', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.find({ query: { $limit: 1 } })
    await users.find({ query: { name: 'jane' } })

    calls.reset((context) => context.params.query?.$limit === 1)

    expect(calls.before.find).toHaveLength(1)
    expect(calls.before.find[0].params.query).toEqual({ name: 'jane' })
  })

  it('stop() stops collecting, start() picks it back up', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })
    calls.stop()
    await users.create({ name: 'ignored' })

    expect(calls.before.create).toHaveLength(1)

    calls.start()
    await users.create({ name: 'john' })

    expect(calls.before.create).toHaveLength(2)
    expect(calls.before.create.map((context) => context.data)).toEqual([
      { name: 'jane' },
      { name: 'john' },
    ])
  })

  it('only records the given methods', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { method: 'find' })

    await users.create({ name: 'jane' })
    await users.find({})

    expect(calls.before.create).toHaveLength(0)
    expect(calls.all).toHaveLength(1)
    expect(calls.all[0].method).toBe('find')
  })

  it('only records the given services', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app, { path: 'users' })

    await users.create({ name: 'jane' })
    await todos.create({ name: 'todo' })

    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.create[0].path).toBe('users')
  })

  it('narrows by path, method and type together, arrays matching any value', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app, {
      path: ['users', 'todos'],
      method: ['create', 'find'],
      type: ['before', 'after'],
    })

    const user = await users.create({ name: 'jane' })
    await users.patch(user.id, { name: 'changed' })
    await todos.find({})
    await todos.remove(null)

    expect(calls.all).toHaveLength(4)
    expect(calls.before.create).toHaveLength(1)
    expect(calls.after.find).toHaveLength(1)
    expect(calls.before.patch).toHaveLength(0)
    expect(calls.before.remove).toHaveLength(0)
  })

  it('records custom methods under their own key', async function () {
    const app = feathers()

    app.use(
      'custom',
      {
        async find() {
          return []
        },
        async doThing() {
          return 'done'
        },
      } as any,
      { methods: ['find', 'doThing'] },
    )

    const calls = recordHooks(app)

    await (app.service('custom') as any).doThing()

    expect(calls.before.doThing).toHaveLength(1)
    expect(calls.all[0].method).toBe('doThing')
  })

  it('records in the `after` hook when asked, with the result available', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'after' })

    await users.create({ name: 'jane' })

    expect(calls.before.create).toHaveLength(0)
    expect(calls.after.create).toHaveLength(1)
    expect(calls.after.create[0].result).toMatchObject({ name: 'jane' })
  })

  it('records both sides of a call when given several types', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: ['before', 'after'] })

    await users.create({ name: 'jane' })

    // the same context, recorded on the way in and on the way out
    expect(calls.all).toHaveLength(2)
    expect(calls.before.create).toHaveLength(1)
    expect(calls.after.create).toHaveLength(1)
  })

  it('records the `error` type with the error available', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: ['before', 'error'] })

    await expect(users.get(404)).rejects.toThrow()

    expect(calls.before.get).toHaveLength(1)
    expect(calls.error.get).toHaveLength(1)
    expect(calls.error.get[0].error).toBeDefined()
  })

  it('records the `around` type, which sees the call first', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: ['around', 'before'] })

    await users.create({ name: 'jane' })

    expect(calls.around.create).toHaveLength(1)
    expect(calls.before.create).toHaveLength(1)
    expect(calls.all.map((context) => context.type)).toEqual([
      'around',
      'before',
    ])
  })

  it('records a type once, however often it is given', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: ['before', 'before'] })

    await users.create({ name: 'jane' })

    expect(calls.all).toHaveLength(1)
  })

  it('keeps the hook type a call was recorded in', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: ['before', 'after'] })
    const snapshots = recordHooks(app, {
      type: ['before', 'after'],
      snapshot: true,
    })

    await users.create({ name: 'jane' })

    // feathers sets `context.type` back to `'around'` once the chain moves on
    expect(calls.before.create[0].type).toBe('before')
    expect(calls.after.create[0].type).toBe('after')
    expect(snapshots.before.create[0].type).toBe('before')
    expect(snapshots.after.create[0].type).toBe('after')
  })

  it('records the live context by default, so later hooks show through', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    app.service('users').hooks({
      before: {
        create: [
          (context) => {
            context.data = { ...context.data, name: 'rewritten' }
          },
        ],
      },
    })

    await users.create({ name: 'jane' })

    const [recorded] = calls.before.create

    expect(recorded.data).toEqual({ name: 'rewritten' })
    // the result is only set after the `before` hook that recorded it
    expect(recorded.result).toMatchObject({ name: 'rewritten' })
    expect(recorded.app).toBe(app)
    expect(recorded.service).toBe(users)
  })

  it('snapshot keeps data and query as they were when recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { snapshot: true })

    app.service('users').hooks({
      before: {
        create: [
          (context) => {
            context.data = { ...context.data, name: 'rewritten' }
          },
        ],
        find: [
          (context) => {
            context.params.query = { name: 'rewritten' }
          },
        ],
      },
    })

    await users.create({ name: 'jane' })
    await users.find({ query: { name: 'jane' } })

    expect(calls.before.create[0].data).toEqual({ name: 'jane' })
    expect(calls.before.find[0].params.query).toEqual({ name: 'jane' })
  })

  it('snapshotting does not write back into the live context', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { snapshot: true })

    let liveQuery: unknown
    app.service('users').hooks({
      before: {
        find: [
          (context) => {
            liveQuery = context.params.query
          },
        ],
      },
    })

    await users.find({ query: { name: 'jane' } })

    // the snapshot got its own `arguments`, so the recorded copy and the live
    // context are separate objects
    expect(calls.before.find[0].params.query).not.toBe(liveQuery)
    expect(liveQuery).toEqual({ name: 'jane' })
  })

  it('snapshot keeps app and service by reference', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { snapshot: true })

    await users.create({ name: 'jane' })

    expect(calls.before.create[0].app).toBe(app)
    expect(calls.before.create[0].service).toBe(users)
  })
})
