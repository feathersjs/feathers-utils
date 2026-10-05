import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects } from '../../testing/index.js'
import { findAll } from './find-all.util.js'

type User = { id: number; name: string; active: boolean }

const setup = async (paginate?: { default: number; max: number }) => {
  const app = feathers<{ users: MemoryService<User> }>()
  app.use(
    'users',
    new MemoryService<User>({ startId: 1, multi: true, paginate }),
  )
  await app.service('users').create([
    { name: 'a', active: true },
    { name: 'b', active: false },
    { name: 'c', active: true },
  ])
  return app
}

describe('findAll', () => {
  it('finds all matching items of a service without pagination', async () => {
    const app = await setup()

    expect(
      await findAll(app, 'users', { query: { active: true } }),
    ).toMatchObject([{ name: 'a' }, { name: 'c' }])
  })

  it('finds all items of a paginating service, beyond paginate.max', async () => {
    const app = await setup({ default: 1, max: 2 })

    expect(await findAll(app, 'users')).toHaveLength(3)
  })

  it('keeps paginate: false, whatever params says', async () => {
    const app = await setup({ default: 1, max: 2 })

    expect(
      await findAll(app, 'users', { paginate: { default: 1, max: 1 } }),
    ).toHaveLength(3)
  })

  it('returns the page of a service that paginates anyway', async () => {
    const app = feathers()
    app.use('custom', {
      find: async () => ({ total: 1, limit: 10, skip: 0, data: [{ id: 1 }] }),
    })

    expect(await findAll(app, 'custom')).toEqual([{ id: 1 }])
  })

  it('calls _find, without the hooks of the service, with underscore: true', async () => {
    const app = await setup()
    // a scope that hides every item from `find`
    app.service('users').hooks({
      before: {
        find: [
          (context) => {
            context.params = { ...context.params, query: { name: 'none' } }
          },
        ],
      },
    })

    expect(await findAll(app, 'users')).toEqual([])
    expect(await findAll(app, 'users', {}, { underscore: true })).toHaveLength(
      3,
    )
  })

  it('throws for a service without _find with underscore: true', async () => {
    const app = feathers()
    app.use('custom', { find: async () => [] })

    await expect(
      findAll(app, 'custom', {}, { underscore: true }),
    ).rejects.toThrow("Service 'custom' does not have a '_find' method.")
  })

  it('throws for a service without find', async () => {
    const app = feathers()
    app.use('custom', { get: async (id: number) => ({ id }) })

    await expect(findAll(app, 'custom')).rejects.toThrow(
      "Service 'custom' does not have a 'find' method.",
    )
  })

  it('does not mutate params', async () => {
    const app = await setup({ default: 1, max: 2 })

    const users = await expectNoSideEffects(
      { query: { active: true, $sort: { name: -1 } } },
      (params) => findAll(app, 'users', params),
    )

    expect(users).toMatchObject([{ name: 'c' }, { name: 'a' }])
  })
})
