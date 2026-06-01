import { expectTypeOf, vi } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { setResult } from './set-result.hook.js'
import { Forbidden } from '@feathersjs/errors'

describe('setResult', function () {
  it('sets userId for single item', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: {},
      } as HookContext

      setResult('params.user.id', 'userId')(context)

      assert.strictEqual(
        context.result.userId,
        1,
        `'${method}': result has 'userId:1'`,
      )
    })
  })

  it('overwrites userId for single item', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: { userId: 2 },
      } as HookContext

      setResult('params.user.id', 'userId')(context)

      assert.strictEqual(
        context.result.userId,
        1,
        `'${method}': result has 'userId:1'`,
      )
    })
  })

  it('sets userId for multiple items', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{}, {}, {}],
      } as HookContext

      setResult('params.user.id', 'userId')(context)
      context.result.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': result has 'userId:1'`)
      })
    })
  })

  describe('dispatch', function () {
    it('seeds and writes context.dispatch when dispatch is true (single item)', function () {
      const context = {
        method: 'get',
        type: 'after',
        params: { user: { id: 1 } },
        result: { name: 'John' },
      } as HookContext

      setResult('params.user.id', 'userId', { dispatch: true })(context)

      // dispatch must be populated from result and carry the new field
      expect(context.dispatch).toMatchObject({ name: 'John', userId: 1 })
      // result must NOT be mutated when dispatch is true (only)
      expect((context.result as any).userId).toBeUndefined()
    })

    it('writes both result and dispatch with dispatch: "both" (array)', function () {
      const context = {
        method: 'find',
        type: 'after',
        params: { user: { id: 5 } },
        result: [{ a: 1 }, { a: 2 }],
      } as HookContext

      setResult('params.user.id', 'userId', { dispatch: 'both' })(context)

      context.result.forEach((item: any) => expect(item.userId).toBe(5))
      context.dispatch.forEach((item: any) => expect(item.userId).toBe(5))
    })
  })

  it('overwrites userId for multiple items', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{ userId: 2 }, {}, { userId: 'abc' }],
      } as HookContext

      setResult('params.user.id', 'userId')(context)
      context.result.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': result has 'userId:1'`)
      })
    })
  })

  it("does not change createdById if 'params.user.id' is not provided", function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {},
        result: { userId: 2 },
      } as HookContext

      setResult('params.user.id', 'userId')(context)

      assert.strictEqual(
        context.result.userId,
        2,
        `'${method}': result has 'userId:2'`,
      )
    })
  })

  it("throws if 'external' is set and context.user.id is undefined", function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          provider: 'socket.io',
        },
        result: {},
      } as HookContext

      expect(() => setResult('params.user.id', 'userId')(context)).toThrow(
        Forbidden,
      )
    })
  })

  it("passes if 'external' and 'allowUndefined: true'", function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        provider: 'socket.io',
        params: {},
        data: {},
      } as unknown as HookContext

      assert.doesNotThrow(
        () =>
          setResult('params.user.id', 'userId', { allowUndefined: true })(
            context,
          ),
        `'${method}': passes`,
      )
    })
  })

  it("passes if 'external' is set and context.user.id is undefined but overwrite: false", function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          provider: 'socket.io',
        },
        result: { userId: 1 },
      } as unknown as HookContext

      assert.doesNotThrow(
        () =>
          setResult('params.user.id', 'userId', { overwrite: false })(context),
        `'${method}': passes`,
      )
    })
  })

  describe('overwrite: false', function () {
    it('sets userId for single item', function () {
      const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

      methods.forEach((method) => {
        const context = {
          method,
          type: 'after',
          params: {
            user: {
              id: 1,
            },
          },
          result: {},
        } as unknown as HookContext

        setResult('params.user.id', 'userId', {
          overwrite: false,
        })(context)

        assert.strictEqual(
          context.result.userId,
          1,
          `'${method}': result has 'userId:1'`,
        )
      })
    })
  })

  it('does not overwrite userId for single item', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: { userId: 2 },
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      assert.strictEqual(
        context.result.userId,
        2,
        `'${method}': result has 'userId:2'`,
      )
    })
  })

  it('sets userId for multiple items', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{}, {}, {}],
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      context.result.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': result has 'userId:1'`)
      })
    })
  })

  it('overwrites userId for multiple items', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: false,
      })(context)

      context.result.forEach((item: any, i: any) => {
        assert.strictEqual(
          item.userId,
          i,
          `'${method}': result has 'userId:${i}`,
        )
      })
    })
  })
})

describe('overwrite: predicate', function () {
  it('overwrites userId for multiple items per predicate', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{ userId: 2 }, {}, { userId: 'abc' }],
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: () => true,
      })(context)

      context.result.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': result has 'userId:1'`)
      })
    })
  })

  it('does not overwrite userId for single item by predicate', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: { userId: 2 },
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: (item: any) => item.userId == null,
      })(context)

      assert.strictEqual(
        context.result.userId,
        2,
        `'${method}': result has 'userId:2'`,
      )
    })
  })

  it('predicate based on context', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: { userId: 2 },
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: (item: any, context) => context.type === 'before',
      })(context)

      assert.strictEqual(
        context.result.userId,
        2,
        `'${method}': result has 'userId:2'`,
      )
    })
  })

  it('overwrites userId for multiple items by predicate', function () {
    const methods = ['find', 'get', 'create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'after',
        params: {
          user: {
            id: 1,
          },
        },
        result: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      setResult('params.user.id', 'userId', {
        overwrite: (item) => item.userId == null,
      })(context)

      context.result.forEach((item: any, i: any) => {
        assert.strictEqual(
          item.userId,
          i,
          `'${method}': result has 'userId:${i}`,
        )
      })
    })
  })
})

describe('around hooks', function () {
  it('awaits next() before mutating result', async function () {
    const context = {
      method: 'get',
      type: 'around',
      params: { user: { id: 1 } },
    } as HookContext
    const next = vi.fn(async () => {
      context.result = {}
    })

    await setResult('params.user.id', 'userId')(context, next)

    expect(next).toHaveBeenCalledOnce()
    expect(context.result.userId).toBe(1)
  })

  it("calls next() when 'from' is missing and no provider", async function () {
    const context = {
      method: 'get',
      type: 'around',
      params: {},
    } as HookContext
    const next = vi.fn(async () => {
      context.result = { userId: 2 }
    })

    await setResult('params.user.id', 'userId')(context, next)

    expect(next).toHaveBeenCalledOnce()
    expect(context.result.userId).toBe(2)
  })

  it("calls next() when 'from' is missing and 'allowUndefined: true'", async function () {
    const context = {
      method: 'get',
      type: 'around',
      params: { provider: 'rest' },
    } as HookContext
    const next = vi.fn(async () => {
      context.result = {}
    })

    await setResult('params.user.id', 'userId', { allowUndefined: true })(
      context,
      next,
    )

    expect(next).toHaveBeenCalledOnce()
  })

  it("throws after next() when 'from' missing and provider set", async function () {
    const context = {
      method: 'get',
      type: 'around',
      params: { provider: 'rest' },
    } as HookContext
    const next = vi.fn(async () => {
      context.result = {}
    })

    await expect(
      setResult('params.user.id', 'userId')(context, next),
    ).rejects.toThrow(Forbidden)
    expect(next).toHaveBeenCalledOnce()
  })
})

describe('integration with service.hooks({ around })', () => {
  type Item = { id: number; name: string; currentUserId?: number }
  type Services = { items: MemoryService<Item> }
  type App = ReturnType<typeof feathers<Services>>
  type Ctx = HookContext<App, MemoryService<Item>>

  it('is type-compatible with AroundHookFunction', () => {
    expectTypeOf(setResult<Ctx>('params.user.id', 'currentUserId')).toExtend<
      AroundHookFunction<App, MemoryService<Item>>
    >()
  })

  it('decorates result.currentUserId from params after find', async () => {
    const app = feathers<Services>()
    app.use('items', new MemoryService<Item>({ multi: true }))
    app.service('items').hooks({
      around: {
        find: [setResult<Ctx>('params.user.id', 'currentUserId')],
      },
    })

    await app.service('items').create([{ name: 'a' }, { name: 'b' }])

    const result = (await app
      .service('items')
      .find({ user: { id: 7 }, paginate: false } as any)) as unknown as Item[]
    expect(result).toHaveLength(2)
    expect(result[0].currentUserId).toBe(7)
    expect(result[1].currentUserId).toBe(7)
  })
})
