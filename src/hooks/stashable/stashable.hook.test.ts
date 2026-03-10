import { assert, expect } from 'vitest'
import type { Application } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { stashable } from './stashable.hook.js'
import { clone } from '../../common/index.js'

const startId = 6
const storeInit = {
  0: { name: 'Jane Doe', key: 'a', id: 0 },
  1: { name: 'Jack Doe', key: 'a', id: 1 },
  2: { name: 'John Doe', key: 'a', id: 2 },
  3: { name: 'Rick Doe', key: 'b', id: 3 },
  4: { name: 'Dick Doe', key: 'b', id: 4 },
  5: { name: 'Dork Doe', key: 'b', id: 5 },
}

let store: any
let finalParams: any

function services(app: Application) {
  store = clone(storeInit)

  app.use(
    'users',
    new MemoryService({
      store,
      startId,
      multi: true,
    }),
  )

  app.service('users').hooks({
    before: {
      all: [
        stashable(),
        (context: any) => {
          finalParams = context.params
        },
      ],
    },
  })
}

describe('stashable', () => {
  let app: Application<{ users: MemoryService }>
  let users: any

  beforeEach(() => {
    finalParams = null
    app = feathers().configure(services)
    users = app.service('users')
  })

  it('stashes lazily on patch', async () => {
    await users.patch(0, { name: 'Updated' })

    expect(typeof finalParams.stashed).toBe('function')
    const before = await finalParams.stashed()
    assert.deepEqual(before, storeInit[0])
  })

  it('stashes lazily on update', async () => {
    await users.update(0, { name: 'Updated' })

    const before = await finalParams.stashed()
    assert.deepEqual(before, storeInit[0])
  })

  it('stashes lazily on remove', async () => {
    await users.remove(0)

    const before = await finalParams.stashed()
    assert.deepEqual(before, storeInit[0])
  })

  it("throws on 'create'", async () => {
    await expect(users.create({})).rejects.toThrow()
  })

  it("throws on 'find'", async () => {
    await expect(users.find({})).rejects.toThrow()
  })

  it("throws on 'get'", async () => {
    await expect(users.get(0)).rejects.toThrow()
  })

  it('memoizes the stash call', async () => {
    let getCalls = 0
    const origGet = app.service('users').get.bind(app.service('users'))
    app.service('users').get = async (id: any, params: any) => {
      getCalls++
      return origGet(id, params)
    }

    await users.patch(0, { name: 'Updated' })

    const first = await finalParams.stashed()
    const second = await finalParams.stashed()
    const third = await finalParams.stashed()

    expect(first).toStrictEqual(second)
    expect(second).toStrictEqual(third)
    // Only one get call despite three stashed() calls
    // (1 extra from the patch internal get)
    expect(getCalls).toBeLessThanOrEqual(2)
  })

  it('returns the same promise on every call', async () => {
    await users.patch(0, { name: 'Updated' })

    const p1 = finalParams.stashed()
    const p2 = finalParams.stashed()
    expect(p1).toBe(p2)
  })

  it('stashes multi patch', async () => {
    const items = [storeInit[0], storeInit[1], storeInit[2]]
    await users.patch(
      null,
      { key: 'c' },
      { query: { id: { $in: items.map((x) => x.id) } } },
    )

    const before = await finalParams.stashed()
    assert.deepEqual(before, items)
  })

  it('stashes multi remove', async () => {
    const items = [storeInit[0], storeInit[1], storeInit[2]]
    await users.remove(null, {
      query: { id: { $in: items.map((x) => x.id) } },
    })

    const before = await finalParams.stashed()
    assert.deepEqual(before, items)
  })

  it('supports custom propName', async () => {
    // Reconfigure with custom propName
    const app2 = feathers()
    app2.use(
      'users',
      new MemoryService({ store: clone(storeInit), startId, multi: true }),
    )
    let params2: any
    app2.service('users').hooks({
      before: {
        all: [
          stashable({ propName: 'before' }),
          (context: any) => {
            params2 = context.params
          },
        ],
      },
    })

    await app2.service('users').patch(0, { name: 'Updated' })

    expect(typeof params2.before).toBe('function')
    const before = await params2.before()
    expect(before.name).toBe('Jane Doe')
  })

  it('supports custom stashFunc', async () => {
    const app2 = feathers()
    app2.use(
      'users',
      new MemoryService({ store: clone(storeInit), startId, multi: true }),
    )
    let params2: any
    app2.service('users').hooks({
      before: {
        all: [
          stashable({
            stashFunc: async () => ({ custom: true }),
          }),
          (context: any) => {
            params2 = context.params
          },
        ],
      },
    })

    await app2.service('users').patch(0, { name: 'Updated' })

    const stashed = await params2.stashed()
    expect(stashed).toStrictEqual({ custom: true })
  })

  it('works as around hook with stashed available after next()', async () => {
    const app2 = feathers()
    app2.use(
      'users',
      new MemoryService({ store: clone(storeInit), startId, multi: true }),
    )
    let stashedBefore: any
    let stashedAfter: any
    let resultAfter: any

    app2.service('users').hooks({
      around: {
        patch: [
          stashable(),
          async (context: any, next: any) => {
            stashedBefore = await context.params.stashed()
            await next()
            stashedAfter = await context.params.stashed()
            resultAfter = context.result
          },
        ],
      },
    })

    await app2.service('users').patch(0, { name: 'Updated' })

    // Before next(): stashed has the original data
    expect(stashedBefore.name).toBe('Jane Doe')
    // After next(): stashed still returns the same (pre-mutation) data
    expect(stashedAfter.name).toBe('Jane Doe')
    // But the actual result has the updated data
    expect(resultAfter.name).toBe('Updated')
    // Same reference — memoized
    expect(stashedBefore).toBe(stashedAfter)
  })

  it('returns undefined on fetch error', async () => {
    const app2 = feathers()
    app2.use(
      'users',
      new MemoryService({ store: clone(storeInit), startId, multi: true }),
    )
    let params2: any
    app2.service('users').hooks({
      before: {
        all: [
          stashable({
            stashFunc: async () => {
              throw new Error('DB error')
            },
          }),
          (context: any) => {
            params2 = context.params
          },
        ],
      },
    })

    await app2.service('users').patch(0, { name: 'Updated' })

    const stashed = await params2.stashed()
    expect(stashed).toBeUndefined()
  })
})
