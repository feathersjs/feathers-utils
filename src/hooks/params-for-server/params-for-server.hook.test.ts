import { expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { paramsForServer } from './params-for-server.hook.js'

describe('paramsForServer', () => {
  it('should move params to query._$client', () => {
    const context = {
      params: {
        a: 1,
        b: 2,
        query: {},
      },
    } as HookContext
    paramsForServer(['a', 'b'])(context)
    expect(context).toEqual({
      params: {
        query: {
          _$client: {
            a: 1,
            b: 2,
          },
        },
      },
    })
  })

  it('should accept a readonly array', () => {
    const whitelist = ['a', 'b'] as const
    const context = {
      params: {
        a: 1,
        b: 2,
        query: {},
      },
    } as HookContext
    paramsForServer(whitelist)(context)
    expect(context).toEqual({
      params: {
        query: {
          _$client: {
            a: 1,
            b: 2,
          },
        },
      },
    })
  })

  it('should move params to query._$client and leave remaining', () => {
    const context = {
      params: {
        a: 1,
        b: 2,
        query: {},
      },
    } as HookContext
    paramsForServer('a')(context)
    expect(context).toEqual({
      params: {
        b: 2,
        query: {
          _$client: {
            a: 1,
          },
        },
      },
    })
  })

  it('does not mutate a pre-existing query._$client on the caller', () => {
    const originalClient = { existing: true }
    const context = {
      params: {
        user: { id: 1 },
        query: { _$client: originalClient },
      },
    } as unknown as HookContext

    paramsForServer('user')(context)

    // The caller's original nested object must be untouched.
    expect(originalClient).toEqual({ existing: true })
    expect((context.params.query as any)._$client).toEqual({
      existing: true,
      user: { id: 1 },
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(paramsForServer('user')).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('packs whitelisted params into query._$client', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())
      app.service('items').hooks({
        around: {
          create: [paramsForServer('user')],
        },
      })

      let seenQuery: any
      app.service('items').hooks({
        around: {
          create: [
            async (ctx, next) => {
              seenQuery = ctx.params.query
              await next()
            },
          ],
        },
      })

      await app.service('items').create({ name: 'Alice' }, {
        user: { id: 1 },
      } as any)

      expect(seenQuery._$client).toEqual({ user: { id: 1 } })
    })
  })
})
