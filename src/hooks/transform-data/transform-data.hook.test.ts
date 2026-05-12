import { assert, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { transformData } from './transform-data.hook.js'

let hookBefore: any
let hookCreateMulti: any

describe('transformData', () => {
  beforeEach(() => {
    hookBefore = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest' },
      data: { first: 'John', last: 'Doe' },
    }
    hookCreateMulti = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest' },
      data: [
        { first: 'John', last: 'Doe' },
        { first: 'Jane', last: 'Doe' },
      ],
    }
  })

  it('context is 2nd param', () => {
    let contextParam
    transformData((_rec: any, { context }: any) => {
      contextParam = context
    })(hookBefore)
    assert.deepEqual(contextParam, hookBefore)
  })

  it('updates hook before::create', () => {
    transformData((item: any) => {
      item.state = 'UT'
    })(hookBefore)
    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create::multi', () => {
    transformData((item: any) => {
      item.state = 'UT'
    })(hookCreateMulti)
    assert.deepEqual(hookCreateMulti.data, [
      { first: 'John', last: 'Doe', state: 'UT' },
      { first: 'Jane', last: 'Doe', state: 'UT' },
    ])
  })

  it('updates hook before::create with new item returned', () => {
    transformData((item: any) => ({ ...item, state: 'UT' }))(hookBefore)
    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('returns a promise that resolves once context is mutated', async () => {
    const promise = transformData(async (item: any) => {
      item.state = 'UT'
    })(hookBefore)

    assert.ok(promise instanceof Promise)

    await promise

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create with new item returned', async () => {
    transformData((item: any) => ({
      ...item,
      state: 'UT',
    }))(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create async', async () => {
    await transformData((item) => {
      item.state = 'UT'
    })(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create async with new item returned', async () => {
    await transformData((item: any) =>
      Promise.resolve({
        ...item,
        state: 'UT',
      }),
    )(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string; state?: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(transformData<Ctx>(() => {})).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('adds state field before create', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())
      app.service('items').hooks({
        around: {
          create: [
            transformData<Ctx>((item) => ({ ...item, state: 'UT' })),
          ],
        },
      })

      const created = await app.service('items').create({ name: 'Alice' })
      expect(created.state).toBe('UT')
    })
  })
})
