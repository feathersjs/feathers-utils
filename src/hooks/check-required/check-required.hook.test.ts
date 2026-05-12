import { assert, expectTypeOf } from 'vitest'
import { checkRequired } from './check-required.hook.js'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'

let hookBefore: HookContext

describe('checkRequired', () => {
  beforeEach(() => {
    hookBefore = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest' },
      data: {
        empl: { name: { first: 'John', last: 'Doe' }, status: 'AA' },
        dept: 'Acct',
      },
    } as HookContext
  })

  it('does 1 prop with no dots', () => {
    checkRequired('empl')(hookBefore)
  })

  it('does multi props with 1 dot', () => {
    checkRequired(['empl.name', 'dept'])(hookBefore)
  })

  it('does multi props with 2 dots', () => {
    checkRequired(['empl.name.last', 'empl.status', 'dept'])(hookBefore)
  })

  it('throws on bad or missing paths', () => {
    assert.throws(() =>
      checkRequired(['empl.name.first', 'empl.name.surname'])(hookBefore),
    )
  })

  it('ignores bad or missing no dot path', () => {
    assert.throws(() => checkRequired('xx')(hookBefore))
  })

  describe('integration with service.hooks({ around })', () => {
    type User = { id: number; email: string; password: string }
    type Services = { users: MemoryService<User> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<User>>

    const setup = () => {
      const app = feathers<Services>()
      app.use('users', new MemoryService<User>())

      app.service('users').hooks({
        around: {
          create: [checkRequired<Ctx>(['email', 'password'])],
        },
      })

      return app
    }

    it('blocks create when a required field is missing', async () => {
      const service = setup().service('users')

      await expect(
        service.create({ email: 'a@b.com' } as User),
      ).rejects.toThrow(/Field password does not exist/)
    })

    it('blocks create when a required field is null', async () => {
      const service = setup().service('users')

      await expect(
        service.create({ email: 'a@b.com', password: '' } as User),
      ).rejects.toThrow(/Field password is null/)
    })

    it('allows create when all required fields are present', async () => {
      const service = setup().service('users')

      const created = await service.create({
        email: 'a@b.com',
        password: 'secret',
      } as User)
      assert.equal(created.email, 'a@b.com')
    })

    it('is type-compatible with AroundHookFunction', () => {
      const hook = checkRequired<Ctx>(['email'])

      expectTypeOf(hook).toExtend<
        AroundHookFunction<App, MemoryService<User>>
      >()
    })
  })
})
