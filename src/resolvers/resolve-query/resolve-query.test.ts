import { expect } from 'vitest'
import { BadRequest } from '@feathersjs/errors'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { resolveQuery } from './resolve-query.js'
import type { HookContext } from '@feathersjs/feathers'

describe('resolve-query', () => {
  it('simple resolver', async () => {
    const context = {
      params: {
        query: {
          name: 'Dave',
          active: false,
        },
      },
    } as unknown as HookContext

    const result = await resolveQuery({
      active: async ({ context: ctx, properties }) => {
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['active'])
        expect(typeof properties.stack[0]).toBe('function')

        return true
      },
    })(context)

    expect(result.params.query).toStrictEqual({
      name: 'Dave',
      active: true,
    })
  })

  it('adds new properties to query', async () => {
    const context = {
      params: {
        query: {
          name: 'Dave',
        },
      },
    } as unknown as HookContext

    await resolveQuery({
      active: async () => true,
    })(context)

    expect(context.params.query).toStrictEqual({
      name: 'Dave',
      active: true,
    })
  })

  it('handles missing query', async () => {
    const context = {
      params: {},
    } as unknown as HookContext

    await resolveQuery({
      active: async () => true,
    })(context)

    expect(context.params.query).toStrictEqual({
      active: true,
    })
  })

  it('sync resolvers work without async overhead', async () => {
    const context = {
      params: {
        query: { name: 'Dave', active: undefined },
      },
    } as unknown as HookContext

    await resolveQuery({
      active: ({ value }) => value ?? true,
    })(context)

    expect(context.params.query).toStrictEqual({
      name: 'Dave',
      active: true,
    })
  })

  it('calls next when provided', async () => {
    const context = {
      params: { query: { name: 'Dave' } },
    } as unknown as HookContext

    let nextCalled = false
    await resolveQuery({
      name: ({ value }) => value,
    })(context, async () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
  })

  it('resolving with errors', async () => {
    const resolver = resolveQuery({
      name: async ({ value }) => {
        if (value === 'Dave') {
          throw new Error(`No ${value}s allowed`)
        }

        return value
      },
      age: async ({ value }: { value: number | undefined }) => {
        if (value && value < 18) {
          throw new BadRequest('Invalid age')
        }

        return value
      },
    })

    await expect(
      resolver({
        params: {
          query: {
            name: 'Dave',
            age: 16,
          },
        },
      } as HookContext),
    ).rejects.toMatchObject({
      name: 'BadRequest',
      message: 'Error resolving data',
      code: 400,
      className: 'bad-request',
      data: {
        name: { message: 'No Daves allowed' },
        age: {
          name: 'BadRequest',
          message: 'Invalid age',
          code: 400,
          className: 'bad-request',
        },
      },
    })
  })

  it('empty resolver returns original query', async () => {
    const query = { name: 'Dave' }
    const context = { params: { query } } as unknown as HookContext

    await resolveQuery({})(context)

    expect(context.params.query).toBe(query)
  })
})

describe('resolve-query as around hook', () => {
  it('resolves query before the service call', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveQuery({
            active: ({ value }) => value ?? true,
          }),
        ],
      },
    })

    await usersService.create({ name: 'Dave', active: true })
    await usersService.create({ name: 'Fred', active: false })

    const result = await usersService.find({ query: {} })

    expect(result).toStrictEqual([
      { id: 1, name: 'Dave', active: true },
    ])
  })

  it('adds default query values when no query is provided', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveQuery({
            active: () => true,
          }),
        ],
      },
    })

    await usersService.create({ name: 'Dave', active: true })
    await usersService.create({ name: 'Fred', active: false })

    const result = await usersService.find()

    expect(result).toStrictEqual([
      { id: 1, name: 'Dave', active: true },
    ])
  })

  it('transforms query values before find', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveQuery({
            name: ({ value }) =>
              typeof value === 'string' ? value.toLowerCase() : value,
          }),
        ],
      },
    })

    await usersService.create({ name: 'dave' })
    await usersService.create({ name: 'fred' })

    const result = await usersService.find({ query: { name: 'DAVE' } })

    expect(result).toStrictEqual([
      { id: 1, name: 'dave' },
    ])
  })
})
