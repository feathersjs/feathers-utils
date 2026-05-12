import { assert, expectTypeOf } from 'vitest'
import { disablePagination } from './disable-pagination.hook.js'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type {
  AroundHookFunction,
  HookContext,
  Paginated,
} from '@feathersjs/feathers'

describe('hook - disablePagination', () => {
  it('disables on $limit = -1', () => {
    const context = {
      type: 'before',
      method: 'find',
      params: { query: { id: 1, $limit: -1 } },
    } as HookContext
    disablePagination()(context)
    assert.deepEqual(context.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = "-1"', () => {
    const context = {
      type: 'before',
      method: 'find',
      params: { query: { id: 1, $limit: '-1' } },
    } as HookContext
    disablePagination()(context)
    assert.deepEqual(context.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = -1 in around', () => {
    const context = {
      type: 'around',
      method: 'find',
      params: { query: { id: 1, $limit: -1 } },
    } as HookContext
    disablePagination()(context)
    assert.deepEqual(context.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = "-1" in around', () => {
    const context = {
      type: 'around',
      method: 'find',
      params: { query: { id: 1, $limit: '-1' } },
    } as HookContext
    disablePagination()(context)
    assert.deepEqual(context.params, { paginate: false, query: { id: 1 } })
  })

  it('throws if after hook', () => {
    assert.throws(() => {
      disablePagination()({
        type: 'after',
        method: 'find',
        params: { query: { id: 1, $limit: -1 } },
      } as HookContext)
    })
  })

  it('throws if not find', () => {
    assert.throws(() => {
      disablePagination()({
        type: 'before',
        method: 'get',
        params: { query: { id: 1, $limit: -1 } },
      } as HookContext)
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type User = { id: number; name: string }
    type Services = { users: MemoryService<User> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<User>>

    const setup = () => {
      const app = feathers<Services>()
      app.use(
        'users',
        new MemoryService<User>({
          paginate: { default: 10, max: 50 },
          multi: true,
        }),
      )

      // The hook is wired in via the `around` map — this line is the actual
      // integration assertion. If `disablePagination`'s signature is not
      // assignable to `AroundHookFunction`, this call will fail type-check.
      app.service('users').hooks({
        around: {
          find: [disablePagination<Ctx>()],
        },
      })

      return app
    }

    it('returns an unpaginated array when query.$limit is -1', async () => {
      const service = setup().service('users')

      await service.create([
        { name: 'Alice' },
        { name: 'Bob' },
        { name: 'Carol' },
      ])

      // Cast: the find() overload sees `$limit: number` (not the literal
      // `paginate: false`), so the static return is `Paginated<User>`. The
      // hook flips `paginate: false` at runtime, which TS can't track.
      const result = (await service.find({
        query: { $limit: -1 },
      })) as unknown as User[]

      assert.isArray(result)
      assert.lengthOf(result, 3)
    })

    it('returns an unpaginated array when query.$limit is "-1"', async () => {
      const service = setup().service('users')

      await service.create([{ name: 'Alice' }, { name: 'Bob' }])

      const result = (await service.find({
        query: { $limit: '-1' as unknown as number },
      })) as unknown as User[]

      assert.isArray(result)
      assert.lengthOf(result, 2)
    })

    it('still paginates when query.$limit is omitted', async () => {
      const service = setup().service('users')

      await service.create([{ name: 'Alice' }, { name: 'Bob' }])

      const result = await service.find()

      expectTypeOf(result).toEqualTypeOf<Paginated<User>>()
      assert.isFalse(Array.isArray(result))
      assert.equal(result.total, 2)
      assert.lengthOf(result.data, 2)
    })

    it('is type-compatible with AroundHookFunction', () => {
      const hook = disablePagination<Ctx>()

      expectTypeOf(hook).toExtend<
        AroundHookFunction<App, MemoryService<User>>
      >()
    })
  })
})
