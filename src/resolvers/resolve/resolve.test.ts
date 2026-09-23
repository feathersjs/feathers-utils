import { expect } from 'vitest'
import { resolve } from './resolve.js'
import type { HookContext } from '@feathersjs/feathers'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('resolve (combined)', () => {
  it('throws if no resolvers are provided', () => {
    expect(() => resolve({})).toThrow('At least one resolver must be provided')
  })

  it('resolves data only', async () => {
    const context = {
      data: { name: 'Dave', email: 'DAVE@TEST.COM' },
    } as unknown as HookContext

    await resolve({
      data: {
        email: async ({ value }: { value: string | undefined }) =>
          value?.toLowerCase(),
      },
    })(context)

    expect(context.data).toStrictEqual({
      name: 'Dave',
      email: 'dave@test.com',
    })
  })

  it('resolves result only', async () => {
    const context = {
      result: { name: 'Dave', password: 'secret' },
    } as unknown as HookContext

    await resolve({
      result: {
        password: async () => undefined,
      },
    })(context)

    expect(context.result).toStrictEqual({
      name: 'Dave',
    })
  })

  it('resolves query only', async () => {
    const context = {
      params: { query: { name: 'Dave' } },
    } as unknown as HookContext

    await resolve({
      query: {
        active: async () => true,
      },
    })(context)

    expect(context.params.query).toStrictEqual({
      name: 'Dave',
      active: true,
    })
  })

  it('resolves data and result together', async () => {
    const context = {
      data: { email: 'DAVE@TEST.COM' },
      result: { password: 'secret', name: 'Dave' },
    } as unknown as HookContext

    await resolve({
      data: {
        email: async ({ value }: { value: string | undefined }) =>
          value?.toLowerCase(),
      },
      result: {
        password: async () => undefined,
      },
    })(context)

    expect(context.data).toStrictEqual({ email: 'dave@test.com' })
    expect(context.result).toStrictEqual({ name: 'Dave' })
  })

  it('resolves data, query, and result together', async () => {
    const context = {
      data: { email: 'DAVE@TEST.COM' },
      params: { query: { name: 'Dave' } },
      result: { password: 'secret', name: 'Dave' },
    } as unknown as HookContext

    await resolve({
      data: {
        email: async ({ value }: { value: string | undefined }) =>
          value?.toLowerCase(),
      },
      query: {
        active: async () => true,
      },
      result: {
        password: async () => undefined,
      },
    })(context)

    expect(context.data).toStrictEqual({ email: 'dave@test.com' })
    expect(context.params.query).toStrictEqual({ name: 'Dave', active: true })
    expect(context.result).toStrictEqual({ name: 'Dave' })
  })

  it('calls next when provided', async () => {
    const context = {
      data: { name: 'Dave' },
      result: { name: 'Dave', password: 'secret' },
    } as unknown as HookContext

    let nextCalled = false

    await resolve({
      data: {
        name: async ({ value }: { value: string | undefined }) =>
          value?.toUpperCase(),
      },
      result: {
        password: async () => undefined,
      },
    })(context, async () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
    expect(context.data).toStrictEqual({ name: 'DAVE' })
    expect(context.result).toStrictEqual({ name: 'Dave' })
  })

  it('does not mutate params', async () => {
    const params = await expectNoSideEffects(
      { query: { name: 'dave', $or: [{ a: 1 }] } },
      async (params) => {
        const context = {
          type: 'before',
          method: 'find',
          params,
        } as HookContext
        await resolve({
          query: { name: ({ value }) => value?.toUpperCase() },
        })(context)
        return context.params
      },
    )
    expect(params.query).toEqual({ name: 'DAVE', $or: [{ a: 1 }] })
  })
})
