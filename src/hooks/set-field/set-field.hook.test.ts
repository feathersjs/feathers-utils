import { assert, expect, vi } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { setField } from './set-field.hook.js'

import type { Application, HookContext, Params } from '@feathersjs/feathers'
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
})
