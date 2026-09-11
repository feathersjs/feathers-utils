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

    // both sides of a call are recorded by default, and nothing failed
    expect(calls.after.create).toHaveLength(1)
    expect(calls.after.find).toHaveLength(2)
    expect(calls.error.create).toHaveLength(0)
    // `around` is only recorded when asked for
    expect(calls.around.create).toHaveLength(0)
  })

  it('reads unrecorded methods as `[]` and lists only recorded ones', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })

    expect(calls.before.get).toEqual([])
    expect(calls.before.aCustomMethod).toEqual([])
    expect(calls.error.create).toEqual([])

    expect(Object.keys(calls.before)).toEqual(['create'])
    expect(Object.keys(calls.after)).toEqual(['create'])
    expect(Object.keys(calls.error)).toEqual([])
  })

  it('collects every recorded hook in order in `all`', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const user = await users.create({ name: 'jane' })
    await users.patch(user.id, { name: 'changed' })
    await users.remove(user.id)

    // one entry per call and recorded type, in the order they ran
    expect(
      calls.all.map((context) => `${context.type} ${context.method}`),
    ).toEqual([
      'before create',
      'after create',
      'before patch',
      'after patch',
      'before remove',
      'after remove',
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
    expect(calls.before.create.map((context) => context.path)).toEqual([
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
    expect(calls.all).toHaveLength(2)

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

    calls.reset({ path: 'todos', method: 'create' })

    expect(calls.all).toHaveLength(4)
    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.create[0].path).toBe('users')
    expect(calls.before.find).toHaveLength(1)
    expect(calls.after.create).toHaveLength(1)

    // the recorded type is matchable too, because it stays on the context
    calls.reset({ type: 'after' })

    expect(calls.all).toHaveLength(2)
    expect(calls.after.create).toHaveLength(0)
    expect(calls.before.create).toHaveLength(1)
  })

  it('reset() takes a predicate as well as criteria', async function () {
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

  it('waitFor() resolves with a call that is already recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })

    const [context] = await calls.waitFor({ context: { method: 'create' } })

    expect(context).toBe(calls.before.create[0])
    expect(context.data).toEqual({ name: 'jane' })
  })

  it('waitFor() resolves with the next matching call', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const pending = calls.waitFor({ context: { method: 'create' } })

    await users.find({})
    await users.create({ name: 'jane' })

    const [context] = await pending

    expect(context.method).toBe('create')
    expect(context.data).toEqual({ name: 'jane' })
  })

  it('waitFor() without criteria takes the first call of any kind', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const pending = calls.waitFor()

    await users.find({})

    const [context] = await pending

    expect(context.method).toBe('find')
  })

  it('waitFor() takes a predicate where criteria do not reach', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const pending = calls.waitFor({
      context: (context) => context.params.query?.$limit === 1,
    })

    await users.find({ query: {} })
    await users.find({ query: { $limit: 1 } })

    const [context] = await pending

    expect(context.params.query).toEqual({ $limit: 1 })
  })

  it('waitFor() waits for a specific record', async function () {
    const { app, users } = setup()
    const jane = await users.create({ name: 'jane' })
    const john = await users.create({ name: 'john' })
    const calls = recordHooks(app)

    const pending = calls.waitFor({ context: { method: 'patch', id: john.id } })

    await users.patch(jane.id, { name: 'changed' })
    await users.patch(john.id, { name: 'changed' })

    const [context] = await pending

    expect(context.id).toBe(john.id)
  })

  it('waitFor() counts the calls it already has towards `count`', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })

    const pending = calls.waitFor({
      context: { method: 'create', type: 'before' },
      count: 3,
    })

    await users.create({ name: 'john' })
    await users.create({ name: 'jim' })

    const contexts = await pending

    expect(contexts).toHaveLength(3)
    expect(contexts.map((context) => context.data)).toEqual([
      { name: 'jane' },
      { name: 'john' },
      { name: 'jim' },
    ])
  })

  it('waitFor() rejects on timeout, counting what it saw', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const pending = calls.waitFor({
      context: { method: 'remove' },
      timeout: 30,
    })

    await users.create({ name: 'jane' })
    await users.find({})

    await expect(pending).rejects.toThrow(
      'Timeout after 30ms waiting for 1 matching call: 0 matched, 4 recorded while waiting',
    )
  })

  it('waitFor() reports the partial count when it times out', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    const pending = calls.waitFor({
      context: { method: 'create', type: 'before' },
      count: 3,
      timeout: 30,
    })

    await users.create({ name: 'jane' })

    await expect(pending).rejects.toThrow(
      'Timeout after 30ms waiting for 3 matching calls: 1 matched, 2 recorded while waiting',
    )
  })

  it('waitFor() does not see calls that are not recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { path: 'todos' })

    const pending = calls.waitFor({ timeout: 30 })

    await users.create({ name: 'jane' })

    await expect(pending).rejects.toThrow(/Timeout/)
  })

  it('waitFor() with `count: 0` resolves when the window passes quietly', async function () {
    const { app, todos } = setup()
    const calls = recordHooks(app)

    await todos.create({ name: 'todo' })

    await expect(
      calls.waitFor({ context: { path: 'users' }, count: 0, timeout: 20 }),
    ).resolves.toEqual([])
  })

  it('waitFor() with `count: 0` rejects for a call that is already recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.find({})

    await expect(
      calls.waitFor({ context: { path: 'users' }, count: 0 }),
    ).rejects.toThrow(
      'Expected no matching call, but `before users.find` was already recorded',
    )

    calls.reset()
    await users.patch(null, { name: 'all' })

    await expect(
      calls.waitFor({ context: { path: 'users' }, count: 0 }),
    ).rejects.toThrow('`before users.patch(null)` was already recorded')
  })

  it('waitFor() with `count: 0` rejects as soon as a matching call is recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    // a window long enough that the rejection cannot be the timeout
    const quiet = calls.waitFor({
      context: { path: 'users' },
      count: 0,
      timeout: 5000,
    })

    await users.create({ name: 'jane' })

    await expect(quiet).rejects.toThrow(
      'Expected no matching call within 5000ms, but `before users.create` was recorded',
    )
  })

  it('waitFor() with `resetBefore` counts only what comes next', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app)

    await users.find({})
    await todos.find({})

    // without `resetBefore` the recorded `users` call would reject right away
    await expect(
      calls.waitFor({
        context: { path: 'users' },
        count: 0,
        resetBefore: true,
        timeout: 20,
      }),
    ).resolves.toEqual([])

    // and it forgot only what it matched
    expect(calls.all).toHaveLength(2)
    expect(calls.before.find[0].path).toBe('todos')
  })

  it('waitFor() with `resetAfter` leaves the record without the calls it took', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app)

    await todos.find({})
    await users.create({ name: 'jane' })

    const [context] = await calls.waitFor({
      context: { path: 'users' },
      resetAfter: true,
    })

    expect(context.data).toEqual({ name: 'jane' })
    expect(calls.all).toHaveLength(2)
    expect(calls.before.find[0].path).toBe('todos')
    expect(calls.before.create).toHaveLength(0)
  })

  it('a failed waitFor() keeps the record, `resetAfter` or not', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.create({ name: 'jane' })

    await expect(
      calls.waitFor({
        context: { method: 'remove' },
        timeout: 20,
        resetAfter: true,
      }),
    ).rejects.toThrow(/Timeout/)

    expect(calls.before.create).toHaveLength(1)
  })

  it("waitFor() with `since: 'now'` proves no further call, evidence intact", async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    await users.find({})

    await expect(
      calls.waitFor({
        context: { path: 'users' },
        count: 0,
        since: 'now',
        timeout: 20,
      }),
    ).resolves.toEqual([])

    // unlike `resetBefore`, the call that was already out is still there
    expect(calls.before.find).toHaveLength(1)
  })

  it("waitFor() with `since: 'now'` rejects when a further call arrives", async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    await users.find({})

    const quiet = calls.waitFor({
      context: { path: 'users' },
      count: 0,
      since: 'now',
      timeout: 5000,
    })

    await users.find({})

    await expect(quiet).rejects.toThrow(
      'Expected no matching call within 5000ms, but `before users.find` was recorded',
    )
    expect(calls.before.find).toHaveLength(2)
  })

  it("waitFor() with `since: 'now'` does not count what is already recorded", async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    await users.create({ name: 'jane' })

    const pending = calls.waitFor({
      context: { method: 'create' },
      since: 'now',
    })

    await users.create({ name: 'john' })

    const [context] = await pending

    expect(context.data).toEqual({ name: 'john' })
  })

  it('waitFor() with `quietFor` settles once the calls stop, exactly', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    const pending = calls.waitFor({
      context: { method: 'find' },
      quietFor: 30,
    })

    await users.find({})
    await users.find({})

    const finds = await pending

    // every match, not just the first `count` of them
    expect(finds).toHaveLength(2)
    expect(finds).toEqual(calls.before.find)
  })

  it('waitFor() with `quietFor` counts what is already recorded', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    // the call is out before the wait starts — checking after the fact
    await users.find({})

    expect(
      await calls.waitFor({ context: { method: 'find' }, quietFor: 20 }),
    ).toHaveLength(1)

    // and a further call still pushes the silence out
    const pending = calls.waitFor({ context: { method: 'find' }, quietFor: 20 })
    await users.find({})

    expect(await pending).toHaveLength(2)
  })

  it('waitFor() with `quietFor` waits for `count` before watching the silence', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    const pending = calls.waitFor({
      context: { method: 'find' },
      count: 2,
      quietFor: 20,
      timeout: 500,
    })

    await users.find({})
    await users.find({})

    expect(await pending).toHaveLength(2)
  })

  it('waitFor() with `quietFor` gives up when the calls never stop', async function () {
    vi.useFakeTimers()

    try {
      const { app, users } = setup()
      const calls = recordHooks(app, { type: 'before' })

      const pending = calls.waitFor({
        context: { method: 'find' },
        quietFor: 50,
        timeout: 200,
      })

      // the deadline passes inside the loop, so the expectation is attached
      // before it: a rejection nobody is waiting on yet is an unhandled one
      const rejected = expect(pending).rejects.toThrow(
        'Timeout after 200ms waiting for 50ms without a matching call: 5 matched, 5 recorded while waiting',
      )

      // a call every 40ms keeps pushing the silence out, so the deadline is
      // what settles this — five calls at 0, 40, 80, 120 and 160ms
      for (let call = 0; call < 5; call++) {
        await users.find({})
        await vi.advanceTimersByTimeAsync(40)
      }

      await rejected
    } finally {
      vi.useRealTimers()
    }
  })

  it('waitFor() says so when it waits for a type that is not recorded', async function () {
    const { app } = setup()
    const calls = recordHooks(app, { type: 'before' })

    await expect(calls.waitFor({ context: { type: 'after' } })).rejects.toThrow(
      "Waiting for the `after` hook, but this recorder records `before` — pass `type: ['before', 'after']` to recordHooks",
    )
  })

  it('waitFor() accepts a type union the recorder partly covers', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { type: 'before' })

    const pending = calls.waitFor({
      context: { type: ['before', 'after'], method: 'find' },
    })

    await users.find({})

    const [context] = await pending

    expect(context.type).toBe('before')
  })

  it('waitFor() refuses options that could never settle', async function () {
    const { app } = setup()
    const calls = recordHooks(app)

    await expect(calls.waitFor({ count: 0, timeout: false })).rejects.toThrow(
      TypeError,
    )
    await expect(calls.waitFor({ count: 0, quietFor: 20 })).rejects.toThrow(
      TypeError,
    )
    await expect(calls.waitFor({ quietFor: 0 })).rejects.toThrow(TypeError)
    await expect(
      calls.waitFor({ quietFor: 1000, timeout: 30 }),
    ).rejects.toThrow(
      '`quietFor` (1000ms) must be shorter than `timeout` (30ms), or the silence could never pass',
    )
    await expect(calls.waitFor({ count: -1 })).rejects.toThrow(TypeError)
  })

  it('waitFor() after reset() watches only what comes next', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app)

    await users.find({})
    calls.reset()

    await expect(
      calls.waitFor({ context: { path: 'users' }, count: 0, timeout: 20 }),
    ).resolves.toEqual([])
  })

  it('a filtered reset() while waiting is not a new call', async function () {
    const { app, todos } = setup()
    const calls = recordHooks(app)

    await todos.create({ name: 'todo' })

    const quiet = calls.waitFor({
      context: { path: 'users' },
      count: 0,
      timeout: 20,
    })

    // keeps the `todos` call, so the record is rebuilt while a waiter is
    // attached — rebuilding must not look like calls happening again
    calls.reset(isContext({ path: 'nope' }))

    await expect(quiet).resolves.toEqual([])
    expect(calls.all).toHaveLength(2)
  })

  it('only records the given methods', async function () {
    const { app, users } = setup()
    const calls = recordHooks(app, { method: 'find' })

    await users.create({ name: 'jane' })
    await users.find({})

    expect(calls.before.create).toHaveLength(0)
    expect(calls.before.find).toHaveLength(1)
    expect(calls.all.every((context) => context.method === 'find')).toBe(true)
  })

  it('only records the given services', async function () {
    const { app, users, todos } = setup()
    const calls = recordHooks(app, { path: 'users' })

    await users.create({ name: 'jane' })
    await todos.create({ name: 'todo' })

    expect(calls.before.create).toHaveLength(1)
    expect(calls.before.create[0].path).toBe('users')
  })

  it('only records calls for the given id', async function () {
    const { app, users } = setup()
    const jane = await users.create({ name: 'jane' })
    const john = await users.create({ name: 'john' })

    const single = recordHooks(app, { id: jane.id })
    const multi = recordHooks(app, { id: null })

    await users.patch(jane.id, { name: 'changed' })
    await users.patch(john.id, { name: 'changed' })
    await users.patch(null, { name: 'all' })

    expect(single.before.patch).toHaveLength(1)
    expect(single.before.patch[0].id).toBe(jane.id)

    expect(multi.before.patch).toHaveLength(1)
    expect(multi.before.patch[0].id).toBe(null)
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
