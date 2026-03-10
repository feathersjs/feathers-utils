import { expect } from 'vitest'
import { BadRequest } from '@feathersjs/errors'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { resolveResult } from './resolve-result.js'
import type { HookContext } from '@feathersjs/feathers'

describe('resolve-result', () => {
  it('simple resolver', async () => {
    const context = {
      result: {
        firstName: 'Dave',
        lastName: 'L.',
      },
    } as unknown as HookContext

    await resolveResult({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data: user, context: ctx, properties }) => {
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(context.result).toStrictEqual({
      firstName: 'Dave',
      lastName: 'L.',
      name: 'Dave L.',
    })
  })

  it('array result on create', async () => {
    const context = {
      method: 'create',
      result: [
        {
          firstName: 'Dave',
          lastName: 'L.',
        },
        {
          firstName: 'Fred',
          lastName: 'F.',
        },
      ],
    } as unknown as HookContext

    await resolveResult({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data: user, context: ctx, properties }) => {
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(context.result).toStrictEqual([
      {
        firstName: 'Dave',
        lastName: 'L.',
        name: 'Dave L.',
      },
      {
        firstName: 'Fred',
        lastName: 'F.',
        name: 'Fred F.',
      },
    ])
  })

  it('array result on find', async () => {
    const context = {
      method: 'find',
      result: [
        {
          firstName: 'Dave',
          lastName: 'L.',
        },
        {
          firstName: 'Fred',
          lastName: 'F.',
        },
      ],
    } as unknown as HookContext

    await resolveResult({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data: user, context: ctx, properties }) => {
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(context.result).toStrictEqual([
      {
        firstName: 'Dave',
        lastName: 'L.',
        name: 'Dave L.',
      },
      {
        firstName: 'Fred',
        lastName: 'F.',
        name: 'Fred F.',
      },
    ])
  })

  it('paginated result', async () => {
    const context = {
      method: 'find',
      result: {
        data: [
          {
            firstName: 'Dave',
            lastName: 'L.',
          },
          {
            firstName: 'Fred',
            lastName: 'F.',
          },
        ],
      },
    } as unknown as HookContext

    await resolveResult({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data: user, context: ctx, properties }) => {
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(context.result.data).toStrictEqual([
      {
        firstName: 'Dave',
        lastName: 'L.',
        name: 'Dave L.',
      },
      {
        firstName: 'Fred',
        lastName: 'F.',
        name: 'Fred F.',
      },
    ])
  })

  it('passes correct index i for array result', async () => {
    const indices: number[] = []
    const context = {
      method: 'create',
      result: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    } as unknown as HookContext

    await resolveResult({
      name: ({ value, i }) => {
        indices.push(i)
        return value
      },
    })(context)

    expect(indices).toStrictEqual([0, 1, 2])
  })

  it('passes correct index i for paginated result', async () => {
    const indices: number[] = []
    const context = {
      method: 'find',
      result: {
        data: [{ name: 'A' }, { name: 'B' }],
      },
    } as unknown as HookContext

    await resolveResult({
      name: ({ value, i }) => {
        indices.push(i)
        return value
      },
    })(context)

    expect(indices).toStrictEqual([0, 1])
  })

  it('sync resolvers work without async overhead', async () => {
    const context = {
      result: { name: 'Dave', password: 'secret' },
    } as unknown as HookContext

    await resolveResult({
      password: () => undefined,
    })(context)

    expect(context.result).toStrictEqual({ name: 'Dave' })
  })

  it('calls next before resolving', async () => {
    const order: string[] = []
    const context = {
      result: { name: 'Dave' },
    } as unknown as HookContext

    await resolveResult({
      name: ({ value }) => {
        order.push('resolve')
        return value
      },
    })(context, async () => {
      order.push('next')
    })

    expect(order).toStrictEqual(['next', 'resolve'])
  })

  it('resolving with errors', async () => {
    const resolver = resolveResult({
      name: async ({ value }) => {
        if (value === 'Dave') {
          throw new Error(`No ${value}s allowed`)
        }

        return value
      },
      age: async ({ value }) => {
        if (value && value < 18) {
          throw new BadRequest('Invalid age')
        }

        return value
      },
    })

    await expect(
      resolver({
        result: {
          name: 'Dave',
          age: 16,
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
})

describe('resolve-result as around hook', () => {
  it('resolves single result after service call', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveResult({
            password: () => undefined,
            name: ({ data: user }) => `${user.firstName} ${user.lastName}`,
          }),
        ],
      },
    })

    const created = await usersService.create({
      firstName: 'Dave',
      lastName: 'L.',
      password: 'secret',
    })

    expect(created).toStrictEqual({
      id: 1,
      firstName: 'Dave',
      lastName: 'L.',
      name: 'Dave L.',
    })

    const found = await usersService.get(1)

    expect(found).toStrictEqual({
      id: 1,
      firstName: 'Dave',
      lastName: 'L.',
      name: 'Dave L.',
    })
  })

  it('resolves paginated find result', async () => {
    const app = feathers()
    app.use(
      'users',
      new MemoryService({ startId: 1, paginate: { default: 10 } }),
    )
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveResult({
            password: () => undefined,
          }),
        ],
      },
    })

    await usersService.create({ name: 'Dave', password: 'secret' })
    await usersService.create({ name: 'Fred', password: 'hidden' })

    const result = await usersService.find()

    expect(result).toStrictEqual({
      total: 2,
      limit: 10,
      skip: 0,
      data: [
        { id: 1, name: 'Dave' },
        { id: 2, name: 'Fred' },
      ],
    })
  })

  it('resolves array result on multi create', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1, multi: true }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveResult({
            password: () => undefined,
          }),
        ],
      },
    })

    const created = await usersService.create([
      { name: 'Dave', password: 'secret' },
      { name: 'Fred', password: 'hidden' },
    ])

    expect(created).toStrictEqual([
      { id: 1, name: 'Dave' },
      { id: 2, name: 'Fred' },
    ])
  })
})
