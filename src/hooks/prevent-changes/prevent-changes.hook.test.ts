import { assert, expect } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { BadRequest } from '@feathersjs/errors'
import { preventChanges } from './prevent-changes.hook.js'
import { clone } from '../../common/index.js'

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
              const n: string = item.name
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
      let context: any = await preventChanges(['name', 'address'], {
        error: false,
      })(clone(hookBefore))
      assert.deepEqual(context, hookBefore)

      context = await preventChanges(['name.x', 'x.y.z'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(context, hookBefore)
    })

    it('deletes if props found', async () => {
      let context: any = await preventChanges(['name', 'first'], {
        error: false,
      })(clone(hookBefore))
      assert.deepEqual(
        context.data,
        { last: 'Doe', a: { b: 'john', c: { d: { e: 1 } } } },
        '1',
      )

      context = await preventChanges(['name', 'a'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(context.data, { first: 'John', last: 'Doe' }, '2')

      context = await preventChanges(['name', 'a.b'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { c: { d: { e: 1 } } } },
        '3',
      )

      context = await preventChanges(['name', 'a.c'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { b: 'john' } },
        '4',
      )

      context = await preventChanges(['name', 'a.c.d.e'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(
        context.data,
        { first: 'John', last: 'Doe', a: { b: 'john', c: { d: {} } } },
        '5',
      )

      context = await preventChanges(['first', 'last'], { error: false })(
        clone(hookBefore),
      )
      assert.deepEqual(context.data, { a: { b: 'john', c: { d: { e: 1 } } } })

      context = await preventChanges(['first', 'a.b', 'a.c.d.e'], {
        error: false,
      })(clone(hookBefore))
      assert.deepEqual(context.data, { last: 'Doe', a: { c: { d: {} } } })
    })
  })
})
