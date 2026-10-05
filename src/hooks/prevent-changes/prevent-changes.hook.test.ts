import { assert, expect } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { BadRequest } from '@feathersjs/errors'
import { preventChanges } from './prevent-changes.hook.js'
import { clone } from '../../common/index.js'
import { expectNoSideEffects, runHook } from '../../testing/index.js'

type User = {
  id: number
  name: string
  email: string
  role: {
    type: string
  }
}

const mockAppStronglyTyped = () => {
  const app = feathers<{
    users: MemoryService<User>
  }>()

  app.use('users', new MemoryService<User>({ startId: 1, multi: true }))

  const usersService = app.service('users')

  return {
    app,
    usersService,
  }
}

describe('preventChanges (type tests)', () => {
  it('accepts valid field names', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      before: {
        patch: [preventChanges(['name', 'email', 'role.type'])],
      },
    })
  })

  it('errors on invalid field names', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      before: {
        patch: [
          // @ts-expect-error - 'nonExistent' is not a valid field name
          preventChanges(['nonExistent']),
        ],
      },
    })
  })

  it('accepts a single field name', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      before: {
        patch: [preventChanges('name')],
      },
    })
  })

  it('error callback item is properly typed', function () {
    const { app } = mockAppStronglyTyped()

    app.service('users').hooks({
      before: {
        patch: [
          preventChanges(['name'], {
            error: (item, name) => {
              const n: string | undefined = item.name
              // @ts-expect-error - 'nonExistentProp' does not exist on User
              const bad = item.nonExistentProp
              return new BadRequest('test')
            },
          }),
        ],
      },
    })
  })
})

let hookBefore: any

describe('preventChanges', () => {
  describe('throws if first param is "true"', () => {
    beforeEach(() => {
      hookBefore = {
        type: 'before',
        method: 'patch',
        params: { provider: 'rest' },
        data: {
          first: 'John',
          last: 'Doe',
          a: { b: undefined, c: { d: { e: 1 } } },
        },
      }
    })

    it('does not throw if props not found', async () => {
      await preventChanges(['name', 'address'], { error: true })(hookBefore)
      await preventChanges(['name.x', 'x.y.z'], { error: true })(hookBefore)
    })

    it('throw if props found', async () => {
      await expect(() =>
        preventChanges(['name', 'first'], { error: true })(hookBefore),
      ).rejects.toThrow()
      await expect(() =>
        preventChanges(['name', 'a'], { error: true })(hookBefore),
      ).rejects.toThrow()
      await expect(() =>
        preventChanges(['name', 'a.b'], { error: true })(hookBefore),
      ).rejects.toThrow()
      await expect(() =>
        preventChanges(['name', 'a.c'], { error: true })(hookBefore),
      ).rejects.toThrow()
      await expect(() =>
        preventChanges(['name', 'a.c.d.e'], { error: true })(hookBefore),
      ).rejects.toThrow()
    })
  })

  describe('deletes if first param is "false"', () => {
    beforeEach(() => {
      hookBefore = {
        type: 'before',
        method: 'patch',
        params: { provider: 'rest' },
        data: {
          first: 'John',
          last: 'Doe',
          a: { b: 'john', c: { d: { e: 1 } } },
        },
      }
    })

    it('does not delete if props not found', async () => {
      let context: any = clone(hookBefore)
      await preventChanges(['name', 'address'], { error: false })(context)
      assert.deepEqual(context, hookBefore)

      context = clone(hookBefore)
      await preventChanges(['name.x', 'x.y.z'], { error: false })(context)
      assert.deepEqual(context, hookBefore)
    })

    it('deletes if props found', async () => {
      let context: any = clone(hookBefore)
      await preventChanges(['name', 'first'], { error: false })(context)
      assert.deepEqual(
        context.data,
        { last: 'Doe', a: { b: 'john', c: { d: { e: 1 } } } },
        '1',
      )

      context = clone(hookBefore)
      await preventChanges(['name', 'a'], { error: false })(context)
      assert.deepEqual(context.data, { first: 'John', last: 'Doe' }, '2')

      context = clone(hookBefore)
      await preventChanges(['name', 'a.b'], { error: false })(context)
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { c: { d: { e: 1 } } } },
        '3',
      )

      context = clone(hookBefore)
      await preventChanges(['name', 'a.c'], { error: false })(context)
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { b: 'john' } },
        '4',
      )

      context = clone(hookBefore)
      await preventChanges(['name', 'a.c.d.e'], { error: false })(context)
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { b: 'john', c: { d: {} } } },
        '5',
      )

      context = clone(hookBefore)
      await preventChanges(['first', 'last'], { error: false })(context)
      assert.deepEqual(context.data, { a: { b: 'john', c: { d: { e: 1 } } } })

      context = clone(hookBefore)
      await preventChanges(['first', 'a.b', 'a.c.d.e'], { error: false })(
        context,
      )
      assert.deepEqual(context.data, { last: 'Doe', a: { c: { d: {} } } })
    })
  })

  it('does not mutate params', async () => {
    const data = await expectNoSideEffects(
      { query: { name: 'Jane' } },
      async (params) => {
        const context = await runHook(preventChanges('role'), {
          type: 'before',
          method: 'patch',
          id: 1,
          data: { name: 'Jane', role: 'admin' },
          params,
        })
        return context.data
      },
    )
    assert.deepEqual(data, { name: 'Jane' })
  })
})

describe('preventChanges, compared with the stored items', () => {
  const setup = async (options?: Parameters<typeof preventChanges>[1]) => {
    const { usersService } = mockAppStronglyTyped()
    await usersService.create([
      { name: 'Anna', email: 'anna@x.de', role: { type: 'admin' } },
      { name: 'Ben', email: 'ben@x.de', role: { type: 'user' } },
    ])
    const hook = preventChanges<any>(['email', 'role.type'], options)
    usersService.hooks({ before: { update: [hook], patch: [hook] } })
    const find = vi.spyOn(usersService, 'find')
    return { users: usersService, find }
  }

  describe('update', () => {
    it('gives a changed field its stored value back', async () => {
      const { users } = await setup()

      expect(
        await users.update(1, {
          name: 'Anne',
          email: 'other@x.de',
          role: { type: 'user' },
        }),
      ).toEqual({
        id: 1,
        name: 'Anne',
        email: 'anna@x.de',
        role: { type: 'admin' },
      })
    })

    it('lets unchanged fields pass', async () => {
      const { users } = await setup({ error: true })

      await expect(
        users.update(1, {
          name: 'Anne',
          email: 'anna@x.de',
          role: { type: 'admin' },
        }),
      ).resolves.toMatchObject({ name: 'Anne' })
    })

    it('throws for a changed field with error', async () => {
      const { users } = await setup({ error: true })

      await expect(
        users.update(1, {
          name: 'Anna',
          email: 'other@x.de',
          role: { type: 'admin' },
        }),
      ).rejects.toThrow('Field email may not be changed. (preventChanges)')
    })

    it('fetches only the protected fields', async () => {
      const { users, find } = await setup()

      await users.update(1, {
        name: 'Anne',
        email: 'anna@x.de',
        role: { type: 'admin' },
      })

      expect(find).toHaveBeenCalledWith({
        query: { id: 1, $select: ['id', 'email', 'role'] },
        paginate: false,
      })
    })
  })

  describe('patch with compare', () => {
    it('lets a field with its stored value pass', async () => {
      const { users } = await setup({ compare: true, error: true })

      await expect(
        users.patch(1, { name: 'Anne', email: 'anna@x.de' }),
      ).resolves.toMatchObject({ name: 'Anne', email: 'anna@x.de' })
    })

    it('drops a changed field', async () => {
      const { users } = await setup({ compare: true })

      expect(
        await users.patch(1, { name: 'Anne', role: { type: 'user' } }),
      ).toEqual({
        id: 1,
        name: 'Anne',
        email: 'anna@x.de',
        role: { type: 'admin' },
      })
    })

    it('throws for a changed field with error', async () => {
      const { users } = await setup({ compare: true, error: true })

      await expect(users.patch(1, { email: 'other@x.de' })).rejects.toThrow(
        'Field email may not be changed. (preventChanges)',
      )
    })

    it('does not fetch for a patch without a protected field', async () => {
      const { users, find } = await setup({ compare: true })

      await users.patch(1, { name: 'Anne' })

      expect(find).not.toHaveBeenCalled()
    })

    it('drops a field a multi patch changes for one of the items', async () => {
      const { users } = await setup({ compare: true })

      // stays for Anna, changes for Ben
      const patched = await users.patch(
        null,
        { name: 'X', role: { type: 'admin' } },
        { query: {} },
      )

      expect(patched.map((user) => user.role.type)).toEqual(['admin', 'user'])
    })

    it('counts a key with a dot as a change, since it depends on the adapter', async () => {
      const { users } = await setup({ compare: true, error: true })

      await expect(
        users.patch(1, { 'role.type': 'admin' } as any),
      ).rejects.toThrow('Field role.type may not be changed')
    })

    it('fetches the whole items with select: false', async () => {
      const { users, find } = await setup({ compare: true, select: false })

      await users.patch(1, { email: 'anna@x.de' })

      expect(find).toHaveBeenCalledWith({ query: { id: 1 }, paginate: false })
    })
  })

  it('throws outside before and around hooks when it compares', async () => {
    await expect(
      runHook(preventChanges('email', { compare: true }), {
        type: 'after',
        method: 'patch',
        id: 1,
        data: {},
        result: {},
      }),
    ).rejects.toThrow("The 'preventChanges' hook has invalid context")
  })

  it('does not mutate params or data when it compares', async () => {
    const data = await expectNoSideEffects(
      {
        params: { query: { $select: ['id'] } },
        data: { name: 'Anne', role: { type: 'user' } },
      },
      async ({ params, data }) => {
        const service = new MemoryService<User>({ startId: 1 })
        await service.create({
          name: 'Anna',
          email: 'anna@x.de',
          role: { type: 'admin' },
        })

        const context = await runHook(
          preventChanges<any>(['email', 'role.type'], { compare: true }),
          { type: 'before', method: 'patch', id: 1, data, params, service },
        )
        return context.data
      },
    )

    // `role` replaces the stored one, so it keeps the stored `type`
    expect(data).toEqual({ name: 'Anne', role: { type: 'admin' } })
  })
})
