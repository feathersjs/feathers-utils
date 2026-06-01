import { assert, expectTypeOf } from 'vitest'
import { disallow } from './disallow.hook.js'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'

describe('hook - disallow', () => {
  describe('disallow is compatible with .disable (without predicate)', () => {
    let hookRest: any
    let hookSocketio: any
    let hookServer: any

    beforeEach(() => {
      hookRest = { method: 'create', params: { provider: 'rest' } }
      hookSocketio = { method: 'create', params: { provider: 'socketio' } }
      hookServer = { method: 'create', params: { provider: '' } }
    })

    it('disables all providers with no param', () => {
      assert.throws(() => {
        disallow()(hookSocketio)
      })
      assert.throws(() => {
        disallow()(hookServer)
      })
    })

    it('disables a provider', () => {
      assert.throws(() => {
        disallow('socketio')(hookSocketio)
      })
    })

    it('does not disable the server', () => {
      disallow('socketio')(hookServer)
      assert.throws(() => {
        disallow('socketio')(hookSocketio)
      })
    })

    it('does not disable another provider', () => {
      disallow('socketio')(hookRest)
      assert.throws(() => {
        disallow('socketio')(hookSocketio)
      })
    })

    it('disables multiple providers', () => {
      disallow(['socketio', 'rest'])(hookServer)
      assert.throws(() => {
        disallow(['socketio', 'rest'])(hookSocketio)
      })
      assert.throws(() => {
        disallow(['socketio', 'rest'])(hookRest)
      })
    })

    it('"external" disables all external providers', () => {
      disallow(['socketio', 'rest'])(hookServer)
      assert.throws(() => {
        disallow(['socketio', 'rest'])(hookSocketio)
      })
      assert.throws(() => {
        disallow(['socketio', 'rest'])(hookRest)
      })
    })
  })

  describe('disallow functionality is like isProvider', () => {
    let hookServer: any
    let hookSocketio: any

    beforeEach(() => {
      hookServer = {
        type: 'before',
        method: 'create',
        params: { provider: '' },
      }
      hookSocketio = {
        type: 'before',
        method: 'create',
        params: { provider: 'socketio' },
      }
    })

    it('returns a function', () => {
      const fcn = disallow('server')

      assert.isFunction(fcn)
    })

    it('throws on no args', () => {
      assert.throws(() => disallow()({} as any))
    })

    it('treats an empty transport array as block-all', () => {
      assert.throws(
        () =>
          disallow([])({
            method: 'create',
            params: { provider: 'rest' },
          } as any),
        /Method not allowed/,
      )
      // also blocks internal callers (fail closed)
      assert.throws(
        () =>
          disallow([])({ method: 'create', params: { provider: '' } } as any),
        /Method not allowed/,
      )
    })

    it('finds provider with 1 arg', () => {
      const hook = structuredClone(hookSocketio)

      const result = disallow('rest')(hook)
      assert.equal(result, undefined)

      assert.throws(() => {
        disallow('socketio')(hook)
      })
    })

    it('finds provider with 2 args', () => {
      const hook = structuredClone(hookSocketio)

      const result = disallow(['rest', 'server'])(hook)
      assert.equal(result, undefined)

      assert.throws(() => {
        disallow(['rest', 'socketio'])(hook)
      })
    })

    it('finds server', () => {
      const hook = structuredClone(hookServer)

      const result = disallow(['rest', 'socketio', 'external'])(hook)
      assert.equal(result, undefined)

      assert.throws(() => {
        disallow(['rest', 'socketio', 'server'])(hook)
      })
    })

    it('finds external', () => {
      const hook = structuredClone(hookSocketio)

      const result = disallow(['rest', 'server'])(hook)
      assert.equal(result, undefined)

      assert.throws(() => {
        disallow(['rest', 'server', 'external'])(hook)
      })
    })

    it('succeeds if not provider', () => {
      const hook = structuredClone(hookServer)

      const result = disallow('socketio')(hook)
      assert.equal(result, undefined)
    })

    it('succeeds if not external', () => {
      const hook = structuredClone(hookServer)

      const result = disallow('external')(hook)
      assert.equal(result, undefined)
    })

    it('succeeds if not server', () => {
      const hook = structuredClone(hookSocketio)

      const result = disallow('server')(hook)
      assert.equal(result, undefined)
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type User = { id: number; name: string }
    type Services = { users: MemoryService<User> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<User>>

    const setup = () => {
      const app = feathers<Services>()
      app.use('users', new MemoryService<User>({ multi: true }))

      // Wiring the hook into the `around` map exercises type compatibility
      // with feathers' strict `AroundHookFunction`.
      app.service('users').hooks({
        around: {
          create: [disallow<Ctx>('external')],
          remove: [disallow<Ctx>()],
        },
      })

      return app
    }

    it('blocks "external" provider on create', async () => {
      const service = setup().service('users')

      await expect(
        service.create({ name: 'Alice' }, { provider: 'rest' }),
      ).rejects.toThrow(/Provider 'rest' can not call 'create'/)
    })

    it('allows internal (no-provider) create', async () => {
      const service = setup().service('users')

      const created = await service.create({ name: 'Alice' })
      assert.equal(created.name, 'Alice')
    })

    it('blocks remove for every caller', async () => {
      const service = setup().service('users')
      const created = await service.create({ name: 'Alice' })

      await expect(service.remove(created.id)).rejects.toThrow(
        /Method not allowed/,
      )
    })

    it('is type-compatible with AroundHookFunction', () => {
      const hook = disallow<Ctx>('external')

      expectTypeOf(hook).toExtend<
        AroundHookFunction<App, MemoryService<User>>
      >()
    })
  })
})
