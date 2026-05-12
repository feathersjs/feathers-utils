import { expectTypeOf, vi } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { setData } from './set-data.hook.js'
import { Forbidden } from '@feathersjs/errors'

describe('setData', function () {
  it('sets userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: {},
      } as HookContext

      setData('params.user.id', 'userId')(context)

      assert.strictEqual(
        context.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })
})

it('overwrites userId for single item', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: { userId: 2 },
    } as HookContext

    setData('params.user.id', 'userId')(context)

    assert.strictEqual(
      context.data.userId,
      1,
      `'${method}': data has 'userId:1'`,
    )
  })
})

it('sets userId for multiple items', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: [{}, {}, {}],
    } as HookContext

    setData('params.user.id', 'userId')(context)
    context.data.forEach((item: any) => {
      assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
    })
  })
})

it('overwrites userId for multiple items', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: [{ userId: 2 }, {}, { userId: 'abc' }],
    } as HookContext

    setData('params.user.id', 'userId')(context)
    context.data.forEach((item: any) => {
      assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
    })
  })
})

it("does not change createdById if 'params.user.id' is not provided", function () {
  const methods = ['create', 'update', 'patch', 'remove']
  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {},
      data: { userId: 2 },
    } as HookContext

    setData('params.user.id', 'userId')(context)

    assert.strictEqual(
      context.data.userId,
      2,
      `'${method}': data has 'userId:2'`,
    )
  })
})

it("throws if 'external' is set and context.user.id is undefined", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        provider: 'socket.io',
      },
      data: {},
    } as HookContext

    expect(() => setData('params.user.id', 'userId')(context)).toThrow(
      Forbidden,
    )
  })
})

it("passes if 'external' and 'allowUndefined: true'", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      provider: 'socket.io',
      params: {},
      data: {},
    } as unknown as HookContext

    assert.doesNotThrow(
      () =>
        setData('params.user.id', 'userId', { allowUndefined: true })(context),
      `'/${method}': passes`,
    )
  })
})

it("passes if 'external' is set and context.user.id is undefined but overwrite: false", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        provider: 'socket.io',
      },
      data: { userId: 1 },
    } as unknown as HookContext

    assert.doesNotThrow(
      () => setData('params.user.id', 'userId', { overwrite: false })(context),
      `'${method}': passes`,
    )
  })
})

describe('overwrite: false', function () {
  it('sets userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: {},
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      assert.strictEqual(
        context.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })

  it('does not overwrite userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      assert.strictEqual(
        context.data.userId,
        2,
        `'${method}': data has 'userId:2'`,
      )
    })
  })

  it('sets userId for multiple items', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{}, {}, {}],
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      context.data.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `${method}': data has 'userId:1'`)
      })
    })
  })

  it('overwrites userId for multiple items', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      context.data.forEach((item: any, i: any) => {
        assert.strictEqual(item.userId, i, `${method}': data has 'userId:${i}`)
      })
    })
  })
})

describe('overwrite: predicate', function () {
  it('overwrites userId for multiple items per predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 2 }, {}, { userId: 'abc' }],
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: () => true,
      })(context)

      context.data.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
      })
    })
  })

  it('does not overwrite userId for single item by predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: (item: any) => item.userId == null,
      })(context)

      assert.strictEqual(
        context.data.userId,
        2,
        `'${method}': data has 'userId:2'`,
      )
    })
  })

  it('predicate based on context', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: (item: any, context) => context.type === 'before',
      })(context)

      assert.strictEqual(
        context.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })

  it('overwrites userId for multiple items by predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      setData('params.user.id', 'userId', {
        overwrite: (item) => item.userId == null,
      })(context)

      context.data.forEach((item: any, i: any) => {
        assert.strictEqual(item.userId, i, `${method}': data has 'userId:${i}`)
      })
    })
  })
})

describe('around hooks', function () {
  it('calls next() after setting data', async function () {
    const context = {
      method: 'create',
      type: 'around',
      params: { user: { id: 1 } },
      data: {},
    } as HookContext
    const next = vi.fn()

    await setData('params.user.id', 'userId')(context, next)

    expect(next).toHaveBeenCalledOnce()
    expect(context.data.userId).toBe(1)
  })

  it("calls next() when 'from' is missing and no provider", async function () {
    const context = {
      method: 'create',
      type: 'around',
      params: {},
      data: { userId: 2 },
    } as HookContext
    const next = vi.fn()

    await setData('params.user.id', 'userId')(context, next)

    expect(next).toHaveBeenCalledOnce()
  })

  it("calls next() when 'from' is missing and 'allowUndefined: true'", async function () {
    const context = {
      method: 'create',
      type: 'around',
      params: { provider: 'socket.io' },
      data: {},
    } as HookContext
    const next = vi.fn()

    await setData('params.user.id', 'userId', { allowUndefined: true })(
      context,
      next,
    )

    expect(next).toHaveBeenCalledOnce()
  })

  it("calls next() when 'from' is missing, 'overwrite: false' and all items have 'to'", async function () {
    const context = {
      method: 'create',
      type: 'around',
      params: { provider: 'socket.io' },
      data: { userId: 1 },
    } as HookContext
    const next = vi.fn()

    await setData('params.user.id', 'userId', { overwrite: false })(
      context,
      next,
    )

    expect(next).toHaveBeenCalledOnce()
  })

  it("does not call next() and throws when 'from' missing, provider set, no 'allowUndefined'", function () {
    const context = {
      method: 'create',
      type: 'around',
      params: { provider: 'socket.io' },
      data: {},
    } as HookContext
    const next = vi.fn()

    expect(() => setData('params.user.id', 'userId')(context, next)).toThrow(
      Forbidden,
    )
    expect(next).not.toHaveBeenCalled()
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string; userId?: number }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(setData<Ctx>('params.user.id', 'userId')).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('sets userId from params before create', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())
      app.service('items').hooks({
        around: {
          create: [setData<Ctx>('params.user.id', 'userId')],
        },
      })

      const created = await app
        .service('items')
        .create({ name: 'a' }, { user: { id: 42 } } as any)
      expect(created.userId).toBe(42)
    })
  })
})
