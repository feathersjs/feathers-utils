import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import type { RunHookOptions } from '../../testing/index.js'
import { stash } from '../define-stash/define-stash.util.js'
import { getMergedData } from './get-merged-data.util.js'

type User = {
  id: number
  firstName: string
  lastName: string
  familyId: number
}

const setup = async () => {
  const users = new MemoryService<User>({ multi: true, startId: 1 })
  await users.create([
    { firstName: 'Anna', lastName: 'Meier', familyId: 7 },
    { firstName: 'Ben', lastName: 'Schmidt', familyId: 7 },
    { firstName: 'Carla', lastName: 'Weber', familyId: 8 },
  ])
  const find = vi.spyOn(users, 'find')
  return { users, find }
}

/** runs `getMergedData` in a before hook of the call */
const mergedData = async (
  fields: (keyof User)[],
  options: Omit<RunHookOptions, 'type'>,
) => {
  let merged: unknown
  await runHook(
    async (context: HookContext) => {
      merged = await getMergedData<User>(context, fields)
    },
    { type: 'before', ...options },
  )
  return merged
}

describe('getMergedData', () => {
  it('reads create data without fetching, per item', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['firstName', 'lastName'], {
        method: 'create',
        data: [{ firstName: 'Dora', lastName: 'Klein' }, { firstName: 'Emil' }],
        service: users,
      }),
    ).toEqual([
      { id: undefined, data: { firstName: 'Dora', lastName: 'Klein' } },
      { id: undefined, data: { firstName: 'Emil' } },
    ])
    expect(find).not.toHaveBeenCalled()
  })

  it('reads update data without fetching', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['firstName', 'lastName'], {
        method: 'update',
        id: 1,
        data: { firstName: 'Anne', lastName: 'Meier', familyId: 7 },
        service: users,
      }),
    ).toEqual([{ id: 1, data: { firstName: 'Anne', lastName: 'Meier' } }])
    expect(find).not.toHaveBeenCalled()
  })

  it('does not fetch for a patch whose data has all the fields', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['firstName', 'lastName'], {
        method: 'patch',
        id: 1,
        data: { firstName: 'Anne', lastName: 'Meyer' },
        service: users,
      }),
    ).toEqual([{ id: 1, data: { firstName: 'Anne', lastName: 'Meyer' } }])
    expect(find).not.toHaveBeenCalled()
  })

  it('fetches the stored item for the fields patch data lacks', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['firstName', 'lastName'], {
        method: 'patch',
        id: 1,
        data: { firstName: 'Anne' },
        service: users,
      }),
    ).toEqual([
      {
        id: 1,
        data: { firstName: 'Anne', lastName: 'Meier' },
        stored: { firstName: 'Anna', lastName: 'Meier' },
      },
    ])
    expect(find).toHaveBeenCalledOnce()
  })

  it('returns an entry per item a multi patch affects', async () => {
    const { users } = await setup()

    expect(
      await mergedData(['firstName', 'lastName'], {
        method: 'patch',
        id: null,
        data: { lastName: 'Müller' },
        params: { query: { familyId: 7 } },
        service: users,
      }),
    ).toEqual([
      {
        id: 1,
        data: { firstName: 'Anna', lastName: 'Müller' },
        stored: { firstName: 'Anna', lastName: 'Meier' },
      },
      {
        id: 2,
        data: { firstName: 'Ben', lastName: 'Müller' },
        stored: { firstName: 'Ben', lastName: 'Schmidt' },
      },
    ])
  })

  it('fetches for a multi patch even if data has all the fields', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['lastName'], {
        method: 'patch',
        id: null,
        data: { lastName: 'Müller' },
        params: { query: { familyId: 8 } },
        service: users,
      }),
    ).toEqual([
      { id: 3, data: { lastName: 'Müller' }, stored: { lastName: 'Weber' } },
    ])
    expect(find).toHaveBeenCalledOnce()
  })

  it('returns nothing for an item the query of the call excludes', async () => {
    const { users } = await setup()

    await expect(
      runHook(
        async (context: HookContext) => {
          expect(await getMergedData(context, 'lastName')).toEqual([])
        },
        {
          type: 'before',
          method: 'patch',
          id: 1,
          data: { firstName: 'Anne' },
          params: { query: { familyId: 8 } },
          service: users,
        },
      ),
    ).rejects.toThrow('No record found')
  })

  it('selects only the id and the fields, instead of the $select of the call', async () => {
    const { users, find } = await setup()

    expect(
      await mergedData(['lastName', 'familyId'], {
        method: 'patch',
        id: 1,
        data: { firstName: 'Anne' },
        params: { query: { $select: ['firstName'] } },
        service: users,
      }),
    ).toEqual([
      {
        id: 1,
        data: { lastName: 'Meier', familyId: 7 },
        stored: { lastName: 'Meier', familyId: 7 },
      },
    ])
    expect((find.mock.calls[0]![0] as any).query.$select).toEqual([
      'id',
      'lastName',
      'familyId',
    ])
  })

  it('shares the fetch with stash and other calls of getMergedData', async () => {
    const { users, find } = await setup()

    await runHook(
      async (context: HookContext) => {
        await stash(context)
        await getMergedData(context, 'firstName')
        await getMergedData(context, ['firstName', 'lastName'])
      },
      {
        type: 'before',
        method: 'patch',
        id: null,
        data: { familyId: 9 },
        params: { query: { familyId: 7 } },
        service: users,
      },
    )

    expect(find).toHaveBeenCalledOnce()
  })

  it('reuses a fetch with more fields, but not one with fewer', async () => {
    const { users, find } = await setup()
    const patch = (hook: (context: HookContext) => Promise<unknown>) =>
      runHook(hook, {
        type: 'before',
        method: 'patch',
        id: null,
        data: { familyId: 9 },
        params: { query: { familyId: 7 } },
        service: users,
      })

    await patch(async (context) => {
      await getMergedData(context, ['firstName', 'lastName'])
      await getMergedData(context, 'firstName')
    })
    expect(find).toHaveBeenCalledOnce()

    find.mockClear()
    await patch(async (context) => {
      await getMergedData(context, 'firstName')
      await getMergedData(context, ['firstName', 'lastName'])
      await stash(context)
    })
    expect(find).toHaveBeenCalledTimes(3)
  })

  it('uses the id field of the service', async () => {
    const people = new MemoryService({ id: 'uid', startId: 5 })
    await people.create({ firstName: 'Anna', lastName: 'Meier' })

    expect(
      await mergedData(['lastName'], {
        method: 'patch',
        id: 5,
        data: { firstName: 'Anne' },
        service: people,
      }),
    ).toEqual([
      { id: 5, data: { lastName: 'Meier' }, stored: { lastName: 'Meier' } },
    ])
  })

  describe('nested fields', () => {
    type Person = {
      id: number
      name: string
      address: { street: string; city: string; zip: string }
    }

    const setupPeople = async () => {
      const people = new MemoryService<Person>({ startId: 1 })
      await people.create({
        name: 'Anna',
        address: { street: 'Hauptstr. 1', city: 'Köln', zip: '50667' },
      })
      const find = vi.spyOn(people, 'find')
      return { people, find }
    }

    const merged = async (
      fields: string[],
      options: Omit<RunHookOptions, 'type'>,
    ) => {
      let result: unknown
      await runHook(
        async (context: HookContext) => {
          result = await getMergedData<Person>(context, fields as any)
        },
        { type: 'before', ...options },
      )
      return result
    }

    it('picks paths, nested the same way', async () => {
      const { people } = await setupPeople()

      expect(
        await merged(['name', 'address.city'], {
          method: 'create',
          data: { name: 'Ben', address: { city: 'Bonn', zip: '53111' } },
          service: people,
        }),
      ).toEqual([
        { id: undefined, data: { name: 'Ben', address: { city: 'Bonn' } } },
      ])
    })

    it('fetches a nested field patch data lacks', async () => {
      const { people, find } = await setupPeople()

      expect(
        await merged(['address.city', 'address.zip'], {
          method: 'patch',
          id: 1,
          data: { name: 'Anne' },
          service: people,
        }),
      ).toEqual([
        {
          id: 1,
          data: { address: { city: 'Köln', zip: '50667' } },
          stored: { address: { city: 'Köln', zip: '50667' } },
        },
      ])
      expect(find).toHaveBeenCalledOnce()
      // nested paths select what they are part of, once
      expect((find.mock.calls[0]![0] as any).query.$select).toEqual([
        'id',
        'address',
      ])
    })

    it('lets a property of patch data replace the stored one as a whole', async () => {
      const { people, find } = await setupPeople()

      // `address` is replaced, so its `city` is gone - nothing to fetch
      expect(
        await merged(['address.street', 'address.city'], {
          method: 'patch',
          id: 1,
          data: { address: { street: 'Ring 2' } },
          service: people,
        }),
      ).toEqual([{ id: 1, data: { address: { street: 'Ring 2' } } }])
      expect(find).not.toHaveBeenCalled()
    })

    it('throws for a patch key with a dot that overlaps a requested field', async () => {
      const { people } = await setupPeople()
      const patch = (fields: string[]) =>
        merged(fields, {
          method: 'patch',
          id: 1,
          data: { 'address.city': 'Bonn' },
          service: people,
        })

      await expect(patch(['address'])).rejects.toThrow(
        "can't tell the outcome of 'address.city'",
      )
      await expect(patch(['address.city'])).rejects.toThrow(
        "can't tell the outcome of 'address.city'",
      )
      await expect(patch(['address.city.part'])).rejects.toThrow(
        "can't tell the outcome of 'address.city'",
      )

      // a sibling path is not affected, whatever the adapter makes of the key
      await expect(patch(['address.zip'])).resolves.toEqual([
        {
          id: 1,
          data: { address: { zip: '50667' } },
          stored: { address: { zip: '50667' } },
        },
      ])
    })
  })

  it('throws for a patch key with a dot on a requested field', async () => {
    const { users } = await setup()
    const patch = (data: object) =>
      mergedData(['lastName'], { method: 'patch', id: 1, data, service: users })

    await expect(patch({ 'lastName.0': 'x' })).rejects.toThrow(
      "can't tell the outcome of 'lastName.0'",
    )

    // a path on another field is fine
    await expect(patch({ 'meta.tag': 'x' })).resolves.toEqual([
      { id: 1, data: { lastName: 'Meier' }, stored: { lastName: 'Meier' } },
    ])
  })

  it('merges keys with a $ as plain keys, since their meaning is up to the adapter', async () => {
    const { users } = await setup()

    await expect(
      mergedData(['lastName'], {
        method: 'patch',
        id: 1,
        data: { $set: { lastName: 'x' } },
        service: users,
      }),
    ).resolves.toEqual([
      { id: 1, data: { lastName: 'Meier' }, stored: { lastName: 'Meier' } },
    ])
  })

  it('throws after the call ran, and outside before and around hooks', async () => {
    await expect(
      runHook(
        async (context: HookContext, next: NextFunction) => {
          await next()
          await getMergedData(context, 'firstName')
        },
        { type: 'around', method: 'patch', id: 1, data: {}, result: {} },
      ),
    ).rejects.toThrow('call already ran')

    await expect(
      runHook((context: HookContext) => getMergedData(context, 'firstName'), {
        type: 'after',
        method: 'patch',
        id: 1,
        data: {},
        result: {},
      }),
    ).rejects.toThrow()

    await expect(
      runHook((context: HookContext) => getMergedData(context, 'firstName'), {
        type: 'before',
        method: 'remove',
        id: 1,
      }),
    ).rejects.toThrow()
  })

  it('does not mutate params', async () => {
    const merged = await expectNoSideEffects(
      { query: { familyId: 7, $select: ['firstName'] } },
      async (params) => {
        const { users } = await setup()
        return await mergedData(['firstName', 'lastName'], {
          method: 'patch',
          id: null,
          data: { lastName: 'Müller' },
          params,
          service: users,
        })
      },
    )

    expect(merged).toEqual([
      {
        id: 1,
        data: { firstName: 'Anna', lastName: 'Müller' },
        stored: { firstName: 'Anna', lastName: 'Meier' },
      },
      {
        id: 2,
        data: { firstName: 'Ben', lastName: 'Müller' },
        stored: { firstName: 'Ben', lastName: 'Schmidt' },
      },
    ])
  })
})
