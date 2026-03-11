import { expect } from 'vitest'
import { BadRequest } from '@feathersjs/errors'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { resolveData } from './resolve-data.js'
import { resolve, type ResolverObject } from '../resolvers.internal.js'
import type { HookContext } from '@feathersjs/feathers'

describe('resolve-data', () => {
  it('simple resolver', async () => {
    const context = {
      data: {
        firstName: 'Dave',
        lastName: 'L.',
      },
    } as unknown as HookContext

    const u = await resolveData({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data, context: ctx, properties }) => {
        const user = data as any
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(u.data).toStrictEqual({
      firstName: 'Dave',
      lastName: 'L.',
      name: 'Dave L.',
    })
  })

  it('array resolver', async () => {
    const context = {
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
    } as unknown as HookContext

    const u = await resolveData({
      password: async (): Promise<undefined> => undefined,

      name: async ({ data, context: ctx, properties }) => {
        const user = data as any
        expect(ctx).toStrictEqual(context)
        expect(properties.path).toStrictEqual(['name'])
        expect(typeof properties.stack[0]).toBe('function')

        return `${user.firstName} ${user.lastName}`
      },
    })(context)

    expect(u.data).toStrictEqual([
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

  it('resolving with errors', async () => {
    const resolver = resolveData({
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
        data: {
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

  it('passes correct index i for array data', async () => {
    const indices: number[] = []
    const context = {
      data: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    } as unknown as HookContext

    await resolveData({
      name: ({ value, i }) => {
        indices.push(i)
        return value
      },
    })(context)

    expect(indices).toStrictEqual([0, 1, 2])
  })

  it('passes i=0 for single data', async () => {
    let receivedIndex = -1
    const context = {
      data: { name: 'Dave' },
    } as unknown as HookContext

    await resolveData({
      name: ({ value, i }) => {
        receivedIndex = i
        return value
      },
    })(context)

    expect(receivedIndex).toBe(0)
  })

  it('sync resolvers work without async overhead', async () => {
    const context = {
      data: { name: '  Dave  ', email: 'DAVE@TEST.COM' },
    } as unknown as HookContext

    const u = await resolveData({
      name: ({ value }) => (typeof value === 'string' ? value.trim() : value),
      email: ({ value }) =>
        typeof value === 'string' ? value.toLowerCase() : value,
    })(context)

    expect(u.data).toStrictEqual({
      name: 'Dave',
      email: 'dave@test.com',
    })
  })

  it('mixed sync and async resolvers', async () => {
    const context = {
      data: { name: '  Dave  ', email: 'DAVE@TEST.COM', role: undefined },
    } as unknown as HookContext

    const u = await resolveData({
      name: ({ value }) => (typeof value === 'string' ? value.trim() : value),
      email: async ({ value }) =>
        typeof value === 'string' ? value.toLowerCase() : value,
      role: ({ value }) => value ?? 'user',
    })(context)

    expect(u.data).toStrictEqual({
      name: 'Dave',
      email: 'dave@test.com',
      role: 'user',
    })
  })

  it('calls next when provided', async () => {
    const context = {
      data: { name: 'Dave' },
    } as unknown as HookContext

    let nextCalled = false
    await resolveData({
      name: ({ value }) => value,
    })(context, async () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
  })

  it('empty resolver returns original data', async () => {
    const resolver = resolveData({})
    const data = { message: 'Hello' }
    const resolved = await resolver({ data } as HookContext)

    expect(data).toBe(resolved.data)
  })
})

describe('resolve stack (circular dependency prevention)', () => {
  // Real-world scenario: a user has a "manager" who is also a user.
  // We want to apply the same resolver to strip passwords from both
  // the user and the nested manager. Without the stack check, the
  // manager resolver would recursively resolve the manager's manager,
  // and so on — infinitely.
  it('skips recursive resolver for self-referential data', () => {
    type User = {
      name: string
      password: string
      manager?: User
    }

    const managerData: User = {
      name: 'Boss',
      password: 'boss-secret',
      manager: undefined,
    }

    const userData: User = {
      name: 'Dave',
      password: 'user-secret',
      manager: managerData,
    }

    const userResolver: ResolverObject<User, HookContext> = {
      password: () => undefined,
      manager: ({ value, properties }) => {
        if (!value) return undefined
        // Re-resolve nested user through the same resolver,
        // passing properties to carry the stack
        return resolve({
          resolvers: userResolver,
          data: value,
          context: {} as HookContext,
          status: properties,
        })
      },
    }

    const result = resolve({
      resolvers: userResolver,
      data: userData,
      context: {} as HookContext,
    }) as User

    // Top-level password is removed
    expect(result.password).toBeUndefined()
    expect(result.name).toBe('Dave')
    // Nested manager's password is also removed
    expect(result.manager?.password).toBeUndefined()
    expect(result.manager?.name).toBe('Boss')
    // The manager resolver is skipped for the nested user (already in stack),
    // so the nested manager field is not resolved again
    expect(result.manager?.manager).toBeUndefined()
  })

  it('allows the same function reference for different properties', () => {
    const toUpper = ({ value }: { value: string | undefined }) =>
      value?.toUpperCase()

    // Same function reference used for two properties in a single resolve()
    // call. The stack check only applies to nested calls, so both resolve fine.
    const result = resolve({
      resolvers: { firstName: toUpper, lastName: toUpper } as any,
      data: { firstName: 'dave', lastName: 'loper' },
      context: {} as HookContext,
    }) as any

    expect(result.firstName).toBe('DAVE')
    expect(result.lastName).toBe('LOPER')
  })

  it('prevents infinite recursion for deeply nested self-references', () => {
    type Node = { name: string; parent?: Node }

    // A tree where each node has a parent — without the stack check,
    // resolving "parent" would call itself infinitely
    const nodeResolver: ResolverObject<Node, HookContext> = {
      name: ({ value }) => value?.toUpperCase(),
      parent: ({ value, properties }) => {
        if (!value) return undefined
        return resolve({
          resolvers: nodeResolver,
          data: value,
          context: {} as HookContext,
          status: properties,
        })
      },
    }

    const data: Node = {
      name: 'child',
      parent: {
        name: 'grandparent',
        parent: {
          name: 'root',
          parent: undefined,
        },
      },
    }

    const result = resolve({
      resolvers: nodeResolver,
      data,
      context: {} as HookContext,
    }) as Node

    // Top level resolves both name and parent
    expect(result.name).toBe('CHILD')
    // First nested level: parent resolver is in the stack, so it's skipped.
    // But name resolver is NOT in the stack, so it still resolves.
    expect(result.parent?.name).toBe('GRANDPARENT')
    // parent resolver was skipped at this level, so grandparent is not resolved further
    expect(result.parent?.parent).toBeUndefined()
  })
})

describe('resolve-data as around hook', () => {
  it('resolves data before the service call', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveData({
            email: ({ value }) =>
              typeof value === 'string' ? value.toLowerCase() : value,
            name: ({ value }) =>
              typeof value === 'string' ? value.trim() : value,
          }),
        ],
      },
    })

    const created = await usersService.create({
      name: '  Dave  ',
      email: 'DAVE@TEST.COM',
    })

    expect(created).toStrictEqual({
      id: 1,
      name: 'Dave',
      email: 'dave@test.com',
    })

    const found = await usersService.get(1)

    expect(found).toStrictEqual({
      id: 1,
      name: 'Dave',
      email: 'dave@test.com',
    })
  })

  it('resolves array data on multi create', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1, multi: true }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveData({
            email: ({ value }) =>
              typeof value === 'string' ? value.toLowerCase() : value,
          }),
        ],
      },
    })

    const created = await usersService.create([
      { name: 'Dave', email: 'DAVE@TEST.COM' },
      { name: 'Fred', email: 'FRED@TEST.COM' },
    ])

    expect(created).toStrictEqual([
      { id: 1, name: 'Dave', email: 'dave@test.com' },
      { id: 2, name: 'Fred', email: 'fred@test.com' },
    ])
  })

  it('resolves data before patch', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1 }))
    const usersService = app.service('users')

    usersService.hooks({
      around: {
        all: [
          resolveData({
            email: ({ value }) =>
              typeof value === 'string' ? value.toLowerCase() : value,
          }),
        ],
      },
    })

    await usersService.create({ name: 'Dave', email: 'dave@test.com' })
    const patched = await usersService.patch(1, { email: 'UPDATED@TEST.COM' })

    expect(patched).toStrictEqual({
      id: 1,
      name: 'Dave',
      email: 'updated@test.com',
    })
  })
})
