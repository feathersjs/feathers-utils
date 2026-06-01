import { assert, expect, expectTypeOf, vi } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { setField } from './set-field.hook.js'

import type {
  Application,
  AroundHookFunction,
  HookContext,
  Params,
} from '@feathersjs/feathers'
import { Forbidden } from '@feathersjs/errors'

type ParamsWithUser = Params & { user?: { id: number; name: string } }

describe('setField', () => {
  const user = {
    id: 1,
    name: 'David',
  }

  let app: Application

  beforeEach(async () => {
    app = feathers()
    app.use('/messages', new MemoryService())
    app.service('messages').hooks({
      before: {
        all: [
          setField({
            from: 'params.user.id',
            as: 'params.query.userId',
          }),
        ],
      },
    })
    await app.service('messages').create({
      id: 1,
      text: 'Message 1',
      userId: 1,
    })
    await app.service('messages').create({
      id: 2,
      text: 'Message 2',
      userId: 2,
    })
  })

  it('find queries with user information, does not modify original objects', async () => {
    const query = {}
    const params: ParamsWithUser = { query, user }
    const results = await app.service('messages').find(params)

    assert.equal(results.length, 1)
    assert.deepEqual(query, {})
  })

  it('adds user information to get, throws NotFound event if record exists', async () => {
    const params: ParamsWithUser = { user }
    await expect(async () => {
      await app.service('messages').get(2, params)
    }).rejects.toThrow()

    const result = await app.service('messages').get(1, params)

    assert.deepEqual(result, {
      id: 1,
      text: 'Message 1',
      userId: 1,
    } as any)
  })

  it('does nothing on internal calls if value does not exists', async () => {
    const results = await app.service('messages').find()

    assert.equal(results.length, 2)
  })

  it('errors on external calls if value does not exists', async () => {
    await expect(async () => {
      await app.service('messages').find({
        provider: 'rest',
      })
    }).rejects.toThrow()
  })

  it('errors when not used as a before hook', async () => {
    app.service('messages').hooks({
      after: {
        get: setField({
          from: 'params.user.id',
          as: 'params.query.userId',
        }),
      },
    })

    await expect(async () => {
      await app.service('messages').get(1)
    }).rejects.toThrow()
  })

  describe('multiple targets and function source', () => {
    it('writes the value to every path when `as` is an array', () => {
      const context = {
        type: 'before',
        method: 'find',
        params: { user: { id: 7 }, query: {} },
      } as HookContext

      setField({
        from: 'params.user.id',
        as: ['params.query.userId', 'params.query.ownerId'],
      })(context)

      expect(context.params.query).toEqual({ userId: 7, ownerId: 7 })
    })

    it('derives the value from a `from` function', () => {
      const context = {
        type: 'before',
        method: 'find',
        params: { user: { id: 3, name: 'David' }, query: {} },
      } as HookContext

      setField<HookContext>({
        from: (ctx) => (ctx.params.user as any)?.name?.toUpperCase(),
        as: 'params.query.userName',
      })(context)

      expect(context.params.query.userName).toBe('DAVID')
    })

    it('throws (external) when the function source returns undefined', () => {
      const context = {
        type: 'before',
        method: 'find',
        params: { provider: 'rest', query: {} },
      } as HookContext

      expect(() =>
        setField<HookContext>({
          from: () => undefined,
          as: 'params.query.userId',
        })(context),
      ).toThrow(Forbidden)
    })
  })

  describe('around hooks', () => {
    it('calls next() after setting field', async () => {
      const context = {
        type: 'around',
        method: 'find',
        params: { user: { id: 1 }, query: {} },
      } as HookContext
      const next = vi.fn()

      await setField({
        from: 'params.user.id',
        as: 'params.query.userId',
      })(context, next)

      expect(next).toHaveBeenCalledOnce()
      expect(context.params.query.userId).toBe(1)
    })

    it('calls next() when value is undefined and no provider', async () => {
      const context = {
        type: 'around',
        method: 'find',
        params: { query: {} },
      } as HookContext
      const next = vi.fn()

      await setField({
        from: 'params.user.id',
        as: 'params.query.userId',
      })(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it("calls next() when value is undefined and 'allowUndefined: true'", async () => {
      const context = {
        type: 'around',
        method: 'find',
        params: { provider: 'rest', query: {} },
      } as HookContext
      const next = vi.fn()

      await setField({
        from: 'params.user.id',
        as: 'params.query.userId',
        allowUndefined: true,
      })(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('does not call next() and throws when value undefined and provider set', () => {
      const context = {
        type: 'around',
        method: 'find',
        params: { provider: 'rest', query: {} },
      } as HookContext
      const next = vi.fn()

      expect(() =>
        setField({
          from: 'params.user.id',
          as: 'params.query.userId',
        })(context, next),
      ).toThrow(Forbidden)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(
        setField<Ctx>({
          from: 'params.user.id',
          as: 'params.query.userId',
        }),
      ).toExtend<AroundHookFunction<App, MemoryService<Item>>>()
    })

    it('scopes find via params.user.id', async () => {
      const app = feathers<Services>()
      app.use(
        'items',
        new MemoryService<Item>({
          multi: true,
          paginate: { default: 10, max: 50 },
        }),
      )
      app.service('items').hooks({
        around: {
          find: [
            setField<Ctx>({ from: 'params.user.id', as: 'params.query.id' }),
          ],
        },
      })

      await app.service('items').create([{ name: 'a' }, { name: 'b' }])

      const result = (await app
        .service('items')
        .find({ user: { id: 1 } } as any)) as any
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe(1)
    })
  })
})
