import { BadRequest } from '@feathersjs/errors'
import type { Query } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { restrictQuery } from './restrict-query.hook.js'

const hook = restrictQuery({
  fields: {
    name: true,
    createdAt: ['$gt', '$lt'],
    address: true,
    'address.zip': ['$in'],
  },
})

/** runs a find of an external caller with the query */
const find = (query: Query) =>
  runHook(hook, {
    type: 'before',
    method: 'find',
    params: { provider: 'rest', query },
  })

describe('restrictQuery', () => {
  it('lets allowed fields and operators pass', async () => {
    await expect(
      find({
        name: { $in: ['a', 'b'] },
        createdAt: { $gt: 1, $lt: 5 },
        $or: [{ name: 'a' }, { createdAt: 3 }],
      }),
    ).resolves.toBeDefined()
  })

  it('throws for a field that is not allowed, in nested branches too', async () => {
    const error = await find({ password: 'x' }).catch((error) => error)

    expect(error).toBeInstanceOf(BadRequest)
    expect(error.message).toBe("'password' is not allowed in the query")
    expect(error.data).toEqual({ field: 'password' })

    await expect(
      find({ $and: [{ name: 'a' }, { $or: [{ password: 'x' }] }] }),
    ).rejects.toThrow("'password' is not allowed")
  })

  it('allows equality and the listed operators of a field with a list', async () => {
    await expect(find({ createdAt: 3 })).resolves.toBeDefined()

    const error = await find({ createdAt: { $ne: 3 } }).catch((error) => error)
    expect(error.message).toBe(
      "The operator '$ne' is not allowed for 'createdAt'",
    )
    expect(error.data).toEqual({ field: 'createdAt', operator: '$ne' })
  })

  it('allows the fields within an allowed one, by the most specific rule', async () => {
    await expect(find({ 'address.city': { $ne: 'x' } })).resolves.toBeDefined()
    // a nested query counts by its path
    await expect(find({ address: { city: 'Köln' } })).resolves.toBeDefined()

    await expect(find({ 'address.zip': { $in: ['1'] } })).resolves.toBeDefined()
    await expect(find({ address: { zip: { $gt: '1' } } })).rejects.toThrow(
      "The operator '$gt' is not allowed for 'address.zip'",
    )
  })

  it('checks $sort and $select', async () => {
    await expect(
      find({ $sort: { name: 1 }, $select: ['name', 'address.city'] }),
    ).resolves.toBeDefined()

    await expect(find({ $sort: { password: 1 } })).rejects.toThrow(
      "'password' is not allowed",
    )
    await expect(find({ $select: ['password'] })).rejects.toThrow(
      "'password' is not allowed",
    )
  })

  it('always allows the id field of the service', async () => {
    await expect(
      find({ id: { $in: [1, 2] }, $sort: { id: -1 }, $select: ['id'] }),
    ).resolves.toBeDefined()

    await expect(
      runHook(hook, {
        type: 'before',
        method: 'find',
        params: { provider: 'rest', query: { _id: 'x' } },
        service: new MemoryService({ id: '_id' }),
      }),
    ).resolves.toBeDefined()
  })

  it('leaves custom filters to the adapter', async () => {
    await expect(
      find({ $populate: 'user', $limit: 1, $skip: 1 }),
    ).resolves.toBeDefined()
  })

  it('does not restrict internal calls', async () => {
    await expect(
      runHook(hook, {
        type: 'before',
        method: 'find',
        params: { query: { password: 'x' } },
      }),
    ).resolves.toBeDefined()
  })

  it('restricts the query of every method', async () => {
    await expect(
      runHook(hook, {
        type: 'before',
        method: 'patch',
        id: null,
        data: {},
        params: { provider: 'rest', query: { password: 'x' } },
      }),
    ).rejects.toThrow("'password' is not allowed")
  })

  it('works as an around hook on a service', async () => {
    const app = feathers()
    app.use('users', new MemoryService())
    app.service('users').hooks({ around: { all: [hook] } })

    await expect(
      app.service('users').find({ provider: 'rest', query: { password: 'x' } }),
    ).rejects.toBeInstanceOf(BadRequest)
  })

  it('throws outside before and around hooks', async () => {
    await expect(
      runHook(hook, { type: 'after', method: 'find' }),
    ).rejects.toThrow("The 'restrictQuery' hook has invalid context")
  })

  it('does not mutate params', async () => {
    await expectNoSideEffects(
      {
        provider: 'rest',
        query: { address: { city: 'Köln' }, $sort: { 'address.zip': 1 } },
      },
      async (params) => {
        const context = await runHook(hook, {
          type: 'before',
          method: 'find',
          params,
        })
        return context.params
      },
    )
  })
})
