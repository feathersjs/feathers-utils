import { expectTypeOf, vi } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { paramsFromClient } from './params-from-client.hook.js'

describe('paramsFromClient', () => {
  it('should move params to query._$client', () => {
    const context = {
      params: {
        query: {
          _$client: {
            a: 1,
            b: 2,
          },
          c: 3,
        },
      },
    } as HookContext
    paramsFromClient(['a', 'b'])(context)
    expect(context).toEqual({
      params: {
        a: 1,
        b: 2,
        query: {
          c: 3,
        },
      },
    })
  })

  it('should move params to query._$client and leave remaining', () => {
    const context = {
      params: {
        query: {
          _$client: {
            a: 1,
            b: 2,
          },
          c: 3,
        },
      },
    } as HookContext
    paramsFromClient('a')(context)
    expect(context).toEqual({
      params: {
        a: 1,
        query: {
          _$client: {
            b: 2,
          },
          c: 3,
        },
      },
    })
  })

  describe('around hooks', () => {
    it('calls next() when _$client key is missing', async () => {
      const context = {
        params: { query: { c: 3 } },
      } as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() when _$client is not an object', async () => {
      const context = {
        params: { query: { _$client: 'not-an-object' } },
      } as unknown as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() after extracting whitelisted params', async () => {
      const context = {
        params: {
          query: {
            _$client: { a: 1 },
            c: 3,
          },
        },
      } as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
      expect(context.params).toEqual({
        a: 1,
        query: { c: 3 },
      })
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(paramsFromClient('user')).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('unpacks _$client into params on the server side', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())

      let seenUser: any
      app.service('items').hooks({
        around: {
          create: [
            paramsFromClient('user'),
            async (ctx, next) => {
              seenUser = (ctx.params as any).user
              await next()
            },
          ],
        },
      })

      await app.service('items').create({ name: 'Alice' }, {
        query: { _$client: { user: { id: 5 } } },
      } as any)

      expect(seenUser).toEqual({ id: 5 })
    })
  })
})
