import { expect } from 'vitest'
import { BadRequest } from '@feathersjs/errors'
import { resolveData } from './resolve-data.js'
import type { HookContext } from '@feathersjs/feathers'

type User = {
  firstName: string
  lastName: string
  password: string
}

describe('resolve-data', () => {
  it('simple resolver', async () => {
    const context = {
      data: {
        firstName: 'Dave',
        lastName: 'L.',
      },
    } as unknown as HookContext

    const u = await resolveData<User>({
      password: async (): Promise<undefined> => undefined,

      name: async (_value, user, ctx, status) => {
        expect(ctx).toStrictEqual(context)
        expect(status.path).toStrictEqual(['name'])
        expect(typeof status.stack[0]).toBe('function')

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

    const u = await resolveData<User>({
      password: async (): Promise<undefined> => undefined,

      name: async (_value, user, ctx, status) => {
        expect(ctx).toStrictEqual(context)
        expect(status.path).toStrictEqual(['name'])
        expect(typeof status.stack[0]).toBe('function')

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
    const resolver = resolveData<{ name: string; age: number }>({
      name: async (value) => {
        if (value === 'Dave') {
          throw new Error(`No ${value}s allowed`)
        }

        return value
      },
      age: async (value) => {
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

  it('empty resolver returns original data', async () => {
    const resolver = resolveData({})
    const data = { message: 'Hello' }
    const resolved = await resolver({ data } as HookContext)

    expect(data).toBe(resolved.data)
  })
})
