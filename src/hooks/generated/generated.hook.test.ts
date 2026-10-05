import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { generated } from './generated.hook.js'
import type { GeneratedOptions } from './generated.hook.js'

type User = {
  id: number
  firstName: string
  lastName: string
  familyId: number
  fullName?: string
  initials?: string
}

type UsersContext = HookContext<any, MemoryService<User>>

const names = (options?: Partial<GeneratedOptions<UsersContext, User>>) => {
  const generate = vi.fn(async (users: Partial<User>[]) =>
    users.map(({ firstName, lastName }) => ({
      fullName: `${firstName} ${lastName}`,
      initials: `${firstName?.[0]}${lastName?.[0]}`,
    })),
  )
  const hook = generated<UsersContext, User>({
    fields: ['fullName', 'initials'],
    from: ['firstName', 'lastName'],
    generate,
    ...options,
  })
  return { hook, generate }
}

const registrations = ['before and after', 'around'] as const
type Registration = (typeof registrations)[number]

const setup = async (
  registration: Registration,
  options?: Partial<GeneratedOptions<UsersContext, User>>,
) => {
  const app = feathers<{ users: MemoryService<User> }>()
  app.use('users', new MemoryService<User>({ multi: true, startId: 1 }))
  const users = app.service('users')
  const { hook, generate } = names(options)

  users.hooks(
    registration === 'around'
      ? { around: { create: [hook], update: [hook], patch: [hook] } }
      : {
          before: { create: [hook], update: [hook], patch: [hook] },
          after: { patch: [hook] },
        },
  )

  await users.create([
    { firstName: 'Anna', lastName: 'Meier', familyId: 7 },
    { firstName: 'Ben', lastName: 'Schmidt', familyId: 7 },
    { firstName: 'Dora', lastName: 'Meier', familyId: 9 },
    { firstName: 'Emil', lastName: 'Meier', familyId: 9 },
  ])

  generate.mockClear()
  const find = vi.spyOn(users, 'find')
  const _patch = vi.spyOn(users, '_patch')

  return { app, users, generate, find, _patch }
}

describe('generated', () => {
  describe.each(registrations)('registered %s', (registration) => {
    describe('create and update', () => {
      it('computes the fields on create', async () => {
        const { users } = await setup(registration)

        expect(
          await users.create({
            firstName: 'Carla',
            lastName: 'Weber',
            familyId: 8,
          }),
        ).toMatchObject({ fullName: 'Carla Weber', initials: 'CW' })
      })

      it('computes all items of a multi create with one call of generate', async () => {
        const { users, generate, find } = await setup(registration)

        const created = await users.create(
          Array.from({ length: 100 }, (_, i) => ({
            firstName: `F${i}`,
            lastName: `L${i}`,
            familyId: 1,
          })),
        )

        expect(generate).toHaveBeenCalledOnce()
        expect(generate.mock.calls[0]![0]).toHaveLength(100)
        expect(created[42]).toMatchObject({ fullName: 'F42 L42' })
        expect(find).not.toHaveBeenCalled()
      })

      it('passes only the from fields, and the context', async () => {
        const { users, generate } = await setup(registration)

        await users.create(
          { firstName: 'Carla', lastName: 'Weber', familyId: 8 },
          { provider: 'rest' },
        )

        const [items, context] = generate.mock.calls[0] as unknown as [
          unknown,
          HookContext,
        ]
        expect(items).toEqual([{ firstName: 'Carla', lastName: 'Weber' }])
        expect(context.params.provider).toBe('rest')
      })

      it('overwrites a value the caller sends for a generated field', async () => {
        const { users } = await setup(registration)

        const created = await users.create({
          firstName: 'Carla',
          lastName: 'Weber',
          familyId: 8,
          fullName: 'fake',
        })

        expect(created.fullName).toBe('Carla Weber')
      })

      it('drops a value the caller sends for a field generate leaves out', async () => {
        const { users } = await setup(registration, {
          // returns no `initials`
          generate: async (users) =>
            users.map(({ firstName }) => ({ fullName: firstName })),
        })

        const created = await users.create({
          firstName: 'Carla',
          lastName: 'Weber',
          familyId: 8,
          initials: 'XX',
        })

        expect(created).not.toHaveProperty('initials')
      })

      it('computes the fields on update, from data', async () => {
        const { users, find } = await setup(registration)

        expect(
          await users.update(1, {
            firstName: 'Anne',
            lastName: 'Meier',
            familyId: 7,
          }),
        ).toMatchObject({ fullName: 'Anne Meier', initials: 'AM' })
        expect(find).not.toHaveBeenCalled()
      })
    })

    describe('patch', () => {
      it('neither computes nor fetches without a from field', async () => {
        const { users, generate, find } = await setup(registration)

        const patched = await users.patch(1, { familyId: 8 })

        expect(patched).toMatchObject({ familyId: 8, fullName: 'Anna Meier' })
        expect(generate).not.toHaveBeenCalled()
        expect(find).not.toHaveBeenCalled()
      })

      it('drops a value the caller patches into a generated field', async () => {
        const { users } = await setup(registration)

        // no from field changes, so the stored `fullName` stays
        const patched = await users.patch(1, { fullName: 'fake' })

        expect(patched).toMatchObject({ fullName: 'Anna Meier' })
      })

      it('does not fetch when data has all from fields', async () => {
        const { users, find } = await setup(registration)

        expect(
          await users.patch(1, { firstName: 'Anne', lastName: 'Muster' }),
        ).toMatchObject({ fullName: 'Anne Muster' })
        expect(find).not.toHaveBeenCalled()
      })

      it('reads the from fields data lacks from the database', async () => {
        const { users, find } = await setup(registration)

        expect(await users.patch(1, { firstName: 'Anne' })).toMatchObject({
          fullName: 'Anne Meier',
          initials: 'AM',
        })
        // only the item, and only the id and the from fields
        expect(find).toHaveBeenCalledOnce()
        expect(find).toHaveBeenCalledWith({
          query: { id: 1, $select: ['id', 'firstName', 'lastName'] },
          paginate: false,
        })
      })

      it('does not compute when the from fields stay as they are', async () => {
        const { users, generate } = await setup(registration)

        // item 1 is Anna already - the fetch of `lastName`, which `data` lacks,
        // shows that neither from field changes
        const patched = await users.patch(1, { firstName: 'Anna', familyId: 8 })

        expect(patched).toMatchObject({ familyId: 8, fullName: 'Anna Meier' })
        expect(generate).not.toHaveBeenCalled()
      })
    })

    describe('multi patch', () => {
      it('computes all items once one of them changes', async () => {
        const { users, generate } = await setup(registration)

        // Anna keeps her name, Ben gets hers
        const patched = await users.patch(
          null,
          { firstName: 'Anna' },
          { query: { familyId: 7 } },
        )

        expect(generate).toHaveBeenCalledOnce()
        expect(generate.mock.calls[0]![0]).toHaveLength(2)
        expect(patched.map((user) => user.fullName)).toEqual([
          'Anna Meier',
          'Anna Schmidt',
        ])
      })

      it('computes once when data has all from fields', async () => {
        const { users, generate, find, _patch } = await setup(registration)

        const patched = await users.patch(
          null,
          { firstName: 'X', lastName: 'Y' },
          { query: { familyId: 7 } },
        )

        expect(patched.map((user) => user.fullName)).toEqual(['X Y', 'X Y'])
        expect(generate).toHaveBeenCalledWith(
          [{ firstName: 'X', lastName: 'Y' }],
          expect.anything(),
        )
        expect(find).not.toHaveBeenCalled()
        expect(_patch).toHaveBeenCalledOnce() // the multi patch itself
      })

      it('writes values that are equal for every item with the call', async () => {
        const { users, _patch } = await setup(registration)

        const patched = await users.patch(
          null,
          { firstName: 'X' },
          { query: { familyId: 9 } },
        )

        expect(patched.map((user) => user.fullName)).toEqual([
          'X Meier',
          'X Meier',
        ])
        expect(_patch).toHaveBeenCalledOnce()
      })

      it('writes values that differ per item after the call', async () => {
        const { users, _patch } = await setup(registration)
        const events: User[] = []
        users.on('patched', (user: User) => events.push(user))

        // also changes `familyId`, which the query of the call selected by
        const patched = await users.patch(
          null,
          { firstName: 'X', familyId: 10 },
          { query: { familyId: 7 } },
        )

        expect(patched.map((user) => user.fullName)).toEqual([
          'X Meier',
          'X Schmidt',
        ])
        expect(await users.find({ query: { familyId: 10 } })).toMatchObject([
          { id: 1, fullName: 'X Meier', initials: 'XM' },
          { id: 2, fullName: 'X Schmidt', initials: 'XS' },
        ])
        // the multi patch, then one per item
        expect(_patch).toHaveBeenCalledTimes(3)
        // the events carry the final items
        expect(events.map((user) => user.fullName)).toEqual([
          'X Meier',
          'X Schmidt',
        ])
      })

      it('keeps the $select of the call for the writes after it', async () => {
        const { users } = await setup(registration)

        expect(
          await users.patch(
            null,
            { firstName: 'X' },
            { query: { familyId: 7, $select: ['id', 'fullName'] } },
          ),
        ).toEqual([
          { id: 1, fullName: 'X Meier' },
          { id: 2, fullName: 'X Schmidt' },
        ])
      })

      it('writes items with equal values with a single write', async () => {
        const { users, _patch } = await setup(registration)

        // 'X Meier' for three items, 'X Schmidt' for one
        const patched = await users.patch(
          null,
          { firstName: 'X' },
          { query: { familyId: { $in: [7, 9] } } },
        )

        expect(patched.map((user) => user.fullName)).toEqual([
          'X Meier',
          'X Schmidt',
          'X Meier',
          'X Meier',
        ])
        // the multi patch, then one write per group
        expect(_patch).toHaveBeenCalledTimes(3)
        expect(_patch.mock.calls[1]).toEqual([
          null,
          { fullName: 'X Meier', initials: 'XM' },
          { query: { id: { $in: [1, 3, 4] } } },
        ])
      })
    })
  })

  it('computes from nested from fields', async () => {
    type Person = {
      id: number
      address: { city: string; zip: string }
      cityLabel?: string
    }
    const people = new MemoryService<Person>({ startId: 1 })
    await people.create({ address: { city: 'Köln', zip: '50667' } })

    const context = await runHook(
      generated<HookContext, Person>({
        fields: 'cityLabel',
        from: 'address.city',
        generate: (people) =>
          people.map(({ address }) => ({
            cityLabel: address?.city?.toUpperCase(),
          })),
      }),
      {
        type: 'before',
        method: 'patch',
        id: 1,
        data: { address: { city: 'Bonn', zip: '53111' } },
        service: people,
      },
    )

    expect(context.result).toMatchObject({ cityLabel: 'BONN' })
  })

  it('throws when generate does not return one value per item', async () => {
    await expect(
      runHook(names({ generate: async () => [] }).hook, {
        type: 'before',
        method: 'create',
        data: { firstName: 'Carla', lastName: 'Weber', familyId: 8 },
      }),
    ).rejects.toThrow('generate returned 0 values for 1 items')
  })

  it('throws for a nested generated field', () => {
    expect(() =>
      generated({
        fields: 'address.label' as any,
        from: 'address',
        generate: (items) => items,
      }),
    ).toThrow("'address.label' is nested")
  })

  it('throws before writing anything when values differ and there is no _patch', async () => {
    const patch = vi.fn()
    const service = {
      find: async () => [
        { id: 1, firstName: 'Anna', lastName: 'Meier' },
        { id: 2, firstName: 'Ben', lastName: 'Schmidt' },
      ],
      patch,
    }

    await expect(
      runHook(names().hook, {
        type: 'before',
        method: 'patch',
        id: null,
        data: { firstName: 'X' },
        service,
      }),
    ).rejects.toThrow("needs the '_patch' method of a database adapter")
    expect(patch).not.toHaveBeenCalled()
  })

  it('gives outer around hooks the final result of a multi patch', async () => {
    const app = feathers<{ users: MemoryService<User> }>()
    app.use('users', new MemoryService<User>({ multi: true, startId: 1 }))
    const users = app.service('users')
    await users.create([
      { firstName: 'Anna', lastName: 'Meier', familyId: 7 },
      { firstName: 'Ben', lastName: 'Schmidt', familyId: 7 },
    ])

    let seen: User[] = []
    // e.g. a resolver of the result, registered before
    const outer = async (context: HookContext, next: NextFunction) => {
      await next()
      seen = context.result
    }
    users.hooks({ around: { patch: [outer, names().hook] } })

    await users.patch(null, { firstName: 'X' }, { query: { familyId: 7 } })

    expect(seen.map((user) => user.fullName)).toEqual(['X Meier', 'X Schmidt'])
  })

  it('throws in error hooks, and for other methods', async () => {
    const { hook } = names()

    await expect(
      runHook(hook, {
        type: 'error',
        method: 'create',
        data: {},
        error: new Error('boom'),
      }),
    ).rejects.toThrow("The 'generated' hook has invalid context")
    await expect(
      runHook(hook, { type: 'before', method: 'find' }),
    ).rejects.toThrow("The 'generated' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const data = await expectNoSideEffects(
      {
        params: { query: { familyId: 7, $select: ['id'] } },
        data: { firstName: 'X', fullName: 'fake' },
      },
      async ({ params, data }) => {
        const service = new MemoryService<User>({ startId: 1 })
        await service.create({
          firstName: 'Anna',
          lastName: 'Meier',
          familyId: 7,
        })

        const context = await runHook(names().hook, {
          type: 'before',
          method: 'patch',
          id: 1,
          data,
          params,
          service,
        })
        return context.data
      },
    )

    expect(data).toEqual({
      firstName: 'X',
      fullName: 'X Meier',
      initials: 'XM',
    })
  })
})
