import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { BadRequest } from '@feathersjs/errors'
import { checkMulti } from '../../hooks/check-multi/check-multi.hook.js'
import { disablePagination } from '../../hooks/disable-pagination/disable-pagination.hook.js'
import { setField } from '../../hooks/set-field/set-field.hook.js'
import { transformResult } from '../../hooks/transform-result/transform-result.hook.js'
import { omit } from '../../transformers/omit/omit.transformer.js'
import { expectNoSideEffects } from '../expect-no-side-effects/expect-no-side-effects.testing.js'
import { runHook } from './run-hook.testing.js'

describe('runHook', function () {
  it('runs a before hook and returns the context', async function () {
    const context = await runHook(
      setField({ from: 'params.user.id', as: 'params.query.userId' }),
      { type: 'before', method: 'find', params: { user: { id: 1 } } },
    )

    expect(context.params.query).toEqual({ userId: 1 })
    expect(context.method).toBe('find')
    expect(context.path).toBe('service')
    expect(context.app).toBeDefined()
    expect(context.service).toBeDefined()
  })

  it('runs an after hook on the result of the stub', async function () {
    const context = await runHook(
      transformResult((user) => omit(user, 'password')),
      { type: 'after', method: 'get', id: 1, result: { id: 1, password: 'x' } },
    )

    expect(context.id).toBe(1)
    expect(context.result).toEqual({ id: 1 })
  })

  it('passes id, data and params per method', async function () {
    const calls: unknown[][] = []
    const record = (context: HookContext) => {
      calls.push([context.method, context.id, context.data, context.params])
    }
    const params = { provider: 'rest' }

    await runHook(record, { type: 'before', method: 'find', params })
    await runHook(record, { type: 'before', method: 'get', id: 1, params })
    await runHook(record, { type: 'before', method: 'create', data: { a: 1 } })
    await runHook(record, {
      type: 'before',
      method: 'update',
      id: 1,
      data: { a: 1 },
    })
    await runHook(record, {
      type: 'before',
      method: 'patch',
      id: null,
      data: { a: 1 },
    })
    await runHook(record, { type: 'before', method: 'remove', id: 2 })

    expect(calls).toEqual([
      ['find', undefined, undefined, params],
      ['get', 1, undefined, params],
      ['create', undefined, { a: 1 }, {}],
      ['update', 1, { a: 1 }, {}],
      ['patch', null, { a: 1 }, {}],
      ['remove', 2, undefined, {}],
    ])
  })

  it('runs custom methods', async function () {
    const context = await runHook(
      (context: HookContext) => {
        context.data = { ...context.data, checked: true }
      },
      { type: 'before', method: 'sendMail', data: { to: 'a' }, result: 'ok' },
    )

    expect(context.data).toEqual({ to: 'a', checked: true })
    expect(context.result).toBe('ok')
  })

  it('skips the stub when a before hook sets the result', async function () {
    const context = await runHook(
      (context: HookContext) => {
        context.result = 'cached'
      },
      { type: 'before', method: 'get', id: 1, result: 'stored' },
    )

    expect(context.result).toBe('cached')
  })

  it('gives an around hook a next that calls the stub', async function () {
    const seen: unknown[] = []
    const context = await runHook(
      async (context: HookContext, next: NextFunction) => {
        seen.push(context.result)
        await next()
        seen.push(context.result)
        context.result = [...context.result, { id: 2 }]
      },
      { type: 'around', method: 'find', result: [{ id: 1 }] },
    )

    expect(seen).toEqual([undefined, [{ id: 1 }]])
    expect(context.result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('runs an error hook on the error of the stub', async function () {
    const context = await runHook(
      (context: HookContext) => {
        expect(context.error).toBeInstanceOf(BadRequest)
        context.result = 'recovered'
      },
      { type: 'error', method: 'get', id: 1, error: new BadRequest() },
    )

    expect(context.result).toBe('recovered')
  })

  it('rejects with the error of the call', async function () {
    const error = new BadRequest('nope')

    await expect(
      runHook(
        () => {
          throw error
        },
        { type: 'before', method: 'find' },
      ),
    ).rejects.toBe(error)

    await expect(
      runHook(() => {}, { type: 'error', method: 'find', error }),
    ).rejects.toBe(error)
  })

  it('runs the hook on a given service', async function () {
    await expect(
      runHook(checkMulti(), {
        type: 'before',
        method: 'create',
        data: [{ name: 'a' }, { name: 'b' }],
        service: new MemoryService({ multi: false }),
      }),
    ).rejects.toThrow()

    const context = await runHook(() => {}, {
      type: 'after',
      method: 'create',
      data: { name: 'a' },
      service: new MemoryService({ startId: 1 }),
    })

    expect(context.result).toEqual({ id: 1, name: 'a' })
  })

  it('registers the service on a given app, and removes it again', async function () {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    await app.service('users').create({ name: 'jane' })

    const context = await runHook(
      async (context: HookContext) => {
        context.result = await context.app.service('users').find()
      },
      { type: 'before', method: 'find', app, path: '/todos/' },
    )

    expect(context.path).toBe('todos')
    expect(context.result).toEqual([{ id: 1, name: 'jane' }])
    expect(app.services.todos).toBeUndefined()

    await expect(
      runHook(() => {}, { type: 'before', method: 'find', app, path: 'users' }),
    ).rejects.toThrow("the app already has a service at 'users'")
  })

  it('removes the service from a given app when the call fails', async function () {
    const app = feathers()

    await expect(
      runHook(
        () => {
          throw new BadRequest()
        },
        { type: 'before', method: 'find', app },
      ),
    ).rejects.toThrow(BadRequest)

    expect(app.services.service).toBeUndefined()
  })

  it('throws for options that would never reach the hook', async function () {
    await expect(
      runHook(() => {}, {
        type: 'after',
        method: 'find',
        result: [],
        service: new MemoryService(),
      }),
    ).rejects.toThrow('leave them out when passing `service`')

    await expect(
      runHook(() => {}, { type: 'error', method: 'find' }),
    ).rejects.toThrow('an error hook only runs when the call fails')
  })

  it('works with expectNoSideEffects', async function () {
    const params = await expectNoSideEffects(
      { query: { $limit: -1 } },
      async (params) => {
        const context = await runHook(disablePagination(), {
          type: 'before',
          method: 'find',
          params,
        })
        return context.params
      },
    )

    expect(params).toEqual({ query: {}, paginate: false })
  })
})
