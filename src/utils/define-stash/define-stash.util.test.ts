import type {
  AroundHookFunction,
  HookContext,
  HookFunction,
} from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { MemoryServiceOptions } from '@feathersjs/memory'
import { expectTypeOf } from 'vitest'
import { expectNoSideEffects } from '../../../test/utils/index.js'
import { recordHooks } from '../../testing/index.js'
import { defineStash, stash, stashed } from './define-stash.util.js'
import type { StashedItem } from './define-stash.util.js'

type User = { id: number; name: string; done?: boolean }

const [startsWithA, startsWithB] = [/^a/, /^b/]

/** like a casl ability: a class instance with methods and hidden state */
class Ability {
  #rules: unknown[]
  ability = this
  constructor(rules: unknown[]) {
    this.#rules = rules
  }
  can() {
    return this.#rules.length > 0
  }
}

/** like a sentry span: a class instance referencing itself through its tree */
class Span {
  op = 'feathers.patch'
  tree: { span: Span; children: Span[] }
  constructor() {
    this.tree = { span: this, children: [this] }
  }
  end() {}
}

const setup = (options: Partial<MemoryServiceOptions<User>> = {}) => {
  const app = feathers<{
    users: MemoryService<User>
    others: MemoryService<User>
  }>()
  app.use(
    'users',
    new MemoryService<User>({ multi: true, startId: 1, ...options }),
  )
  const service = app.service('users')

  const calls = recordHooks(service, {
    type: 'before',
    method: ['get', 'find'],
    snapshot: true,
  })

  return { app, service, calls }
}

/** registers `hook` as an after hook and returns what it returned */
const recordAfter = <T>(
  service: any,
  method: string,
  hook: (context: HookContext) => Promise<T>,
) => {
  const recorded: { value?: T } = {}
  service.hooks({
    after: {
      [method]: [
        async (context: HookContext) => {
          recorded.value = await hook(context)
        },
      ],
    },
  })
  return recorded
}

describe('defineStash', () => {
  it('pairs the item before and after a patch', async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(recorded.value).toStrictEqual([
      { id: 1, before: { id: 1, name: 'a' }, result: { id: 1, name: 'b' } },
    ])
  })

  it('returns only the items before, before the call ran', async () => {
    const { service } = setup()
    let before: StashedItem[] | undefined
    service.hooks({
      before: {
        patch: [
          stash,
          async (context) => {
            before = await stashed(context)
          },
        ],
      },
    })

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(before).toStrictEqual([
      { id: 1, before: { id: 1, name: 'a' }, result: undefined },
    ])
  })

  it('fetches the item of a call with an id with find, by its id', async () => {
    const { service, calls } = setup()
    service.hooks({ before: { patch: [stash] } })
    recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' }, { query: { name: 'a' } })

    expect(calls.before.get).toHaveLength(0)
    expect(calls.before.find.map(({ params }) => params.query)).toStrictEqual([
      { name: 'a', id: 1 },
    ])
  })

  it('keeps a condition on the id field in the query of the call', async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' }, { query: { id: { $ne: 2 } } })

    expect(recorded.value?.[0].before).toStrictEqual({ id: 1, name: 'a' })
  })

  it("fails a call with an id that doesn't match the query with its own error", async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })

    const user = await service.create({ name: 'a' })

    await expect(
      service.patch(user.id, { name: 'b' }, { query: { name: 'x' } }),
    ).rejects.toMatchObject({ name: 'NotFound' })
  })

  it('pairs a multi patch by id, in the order of the result', async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    await service.create([{ name: 'a' }, { name: 'b' }])
    await service.patch(null, { done: true })

    expect(recorded.value).toStrictEqual([
      {
        id: 1,
        before: { id: 1, name: 'a' },
        result: { id: 1, name: 'a', done: true },
      },
      {
        id: 2,
        before: { id: 2, name: 'b' },
        result: { id: 2, name: 'b', done: true },
      },
    ])
  })

  it('fetches nothing before a create', async () => {
    const { service, calls } = setup()
    service.hooks({ before: { create: [stash] } })
    const recorded = recordAfter(service, 'create', stashed)

    await service.create([{ name: 'a' }, { name: 'b' }])

    expect(recorded.value).toStrictEqual([
      { id: 1, before: undefined, result: { id: 1, name: 'a' } },
      { id: 2, before: undefined, result: { id: 2, name: 'b' } },
    ])
    expect(calls.all).toStrictEqual([])
  })

  it('pairs the removed item as result', async () => {
    const { service } = setup()
    service.hooks({ before: { remove: [stash] } })
    const recorded = recordAfter(service, 'remove', stashed)

    const user = await service.create({ name: 'a' })
    await service.remove(user.id)

    expect(recorded.value).toStrictEqual([
      { id: 1, before: { id: 1, name: 'a' }, result: { id: 1, name: 'a' } },
    ])
  })

  it("fetches nothing before the call without 'fetchBefore'", async () => {
    const { service, calls } = setup()
    const { stash, stashed } = defineStash({ fetchBefore: false })
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(recorded.value).toStrictEqual([
      { id: 1, before: undefined, result: { id: 1, name: 'b' } },
    ])
    expect(calls.all).toStrictEqual([])
  })

  it('waits for the fetch, so a slow find hook cannot let the call overtake it', async () => {
    const { service } = setup()
    service.hooks({
      before: {
        find: [() => new Promise<void>((resolve) => setTimeout(resolve, 20))],
        patch: [stash],
      },
    })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(recorded.value?.[0].before).toStrictEqual({ id: 1, name: 'a' })
  })

  it('works as an around hook', async () => {
    const { service } = setup()
    service.hooks({ around: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(recorded.value?.[0]).toMatchObject({
      before: { name: 'a' },
      result: { name: 'b' },
    })
  })

  it("can be called from an around hook with 'next'", async () => {
    const { service } = setup()
    let items: StashedItem[] | undefined
    service.hooks({
      around: {
        patch: [
          async (context, next) => {
            await stash(context, next)
            items = await stashed(context)
          },
        ],
      },
    })

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(items?.[0]).toMatchObject({
      before: { name: 'a' },
      result: { name: 'b' },
    })
  })

  it("applies 'transformParams' to the fetch before and the refetch after the call", async () => {
    const { service, calls } = setup()
    service.hooks({
      after: {
        find: [
          (context) => {
            if ((context.params as any).$populate) {
              context.result = (context.result as User[]).map((user) => ({
                ...user,
                populated: true,
              }))
            }
          },
        ],
      },
    })
    const { stash, stashed } = defineStash({
      transformParams: (params) => ({ ...params, $populate: true }),
    })
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    await service.create([{ name: 'a' }])
    const result = await service.patch(null, { name: 'b' })

    expect(recorded.value).toStrictEqual([
      {
        id: 1,
        before: { id: 1, name: 'a', populated: true },
        result: { id: 1, name: 'b', populated: true },
      },
    ])
    expect(result).toStrictEqual([{ id: 1, name: 'b' }])
    expect(calls.before.find).toHaveLength(2)
    expect(calls.before.find[1].params.query).toStrictEqual({
      id: { $in: [1] },
    })
  })

  it("refetches when 'transformParams' changes the query in place", async () => {
    const { service } = setup()
    const { stash, stashed } = defineStash({
      transformParams: (params) => {
        params.query ??= {}
        params.query.$select = ['id']
        params.query.name?.$in.push('c')
      },
    })
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    await service.create({ name: 'a' })
    const query = { name: { $in: ['a'] } }
    await service.patch(null, { name: 'b' }, { query })

    expect(recorded.value).toStrictEqual([
      { id: 1, before: { id: 1 }, result: { id: 1 } },
    ])
    expect(query, "leaves the caller's query untouched").toStrictEqual({
      name: { $in: ['a'] },
    })
  })

  it("fetches all items, even if 'transformParams' drops 'paginate'", async () => {
    const { service } = setup({ paginate: { default: 1, max: 1 } })
    const { stash, stashed } = defineStash({
      transformParams: ({ query }) => ({ query }),
    })
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    await service.create([{ name: 'a' }, { name: 'b' }])
    await service.patch(null, { done: true })

    expect(
      recorded.value?.map(({ before, result }) => [before?.name, result?.done]),
    ).toStrictEqual([
      ['a', true],
      ['b', true],
    ])
  })

  it("fetches the whole items with '$select'", async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' }, { query: { $select: ['id'] } })

    expect(recorded.value).toStrictEqual([
      { id: 1, before: { id: 1, name: 'a' }, result: { id: 1, name: 'b' } },
    ])
  })

  it("doesn't refetch without 'transformParams' and '$select'", async () => {
    const { service, calls } = setup()
    service.hooks({ before: { patch: [stash] } })
    recordAfter(service, 'patch', stashed)

    await service.create([{ name: 'a' }, { name: 'b' }])
    await service.patch(null, { done: true })

    expect(calls.before.find).toHaveLength(1)
  })

  it('shares the fetch between stashes with equal params', async () => {
    const { service, calls } = setup()
    const [first, second] = [defineStash(), defineStash()]
    service.hooks({ before: { patch: [first.stash, second.stash] } })
    const recorded = recordAfter(service, 'patch', async (context) => [
      await first.stashed(context),
      await second.stashed(context),
    ])

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(calls.before.find).toHaveLength(1)
    expect(recorded.value?.[1]).toStrictEqual(recorded.value?.[0])
  })

  it('fetches once when the same stash is used twice', async () => {
    const { service, calls } = setup()
    service.hooks({ before: { patch: [stash, stash] } })

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    expect(calls.before.find).toHaveLength(1)
  })

  it('gives stashes with different RegExp queries their own fetch', async () => {
    const { service } = setup()
    const withName = (name: RegExp) =>
      defineStash({
        transformParams: (params) => ({
          ...params,
          query: { ...params.query, name },
        }),
      })
    const [a, b] = [withName(startsWithA), withName(startsWithB)]
    service.hooks({ before: { patch: [a.stash, b.stash] } })
    const recorded = recordAfter(service, 'patch', async (context) => [
      await a.stashed(context),
      await b.stashed(context),
    ])

    await service.create([{ name: 'a' }, { name: 'b' }])
    await service.patch(null, { done: true })

    const [itemsOfA, itemsOfB] = recorded.value ?? []
    expect(itemsOfA.map(({ before, result }) => [before, result])).toEqual([
      [
        { id: 1, name: 'a' },
        { id: 1, name: 'a', done: true },
      ],
      [undefined, undefined],
    ])
    expect(itemsOfB.map(({ before, result }) => [before, result])).toEqual([
      [undefined, undefined],
      [
        { id: 2, name: 'b' },
        { id: 2, name: 'b', done: true },
      ],
    ])
  })

  it('works with self-references, functions and class instances on params', async () => {
    const { service } = setup()
    const { stash, stashed } = defineStash({
      // a fresh span for the fetch, looking just like the one of the call
      transformParams: (params) => ({ ...params, span: new Span() }),
    })
    service.hooks({ before: { patch: [stash] } })
    const recorded = recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' }, {
      ability: new Ability([]),
      span: new Span(),
    } as any)

    expect(recorded.value).toStrictEqual([
      { id: 1, before: { id: 1, name: 'a' }, result: { id: 1, name: 'b' } },
    ])
  })

  it('keeps concurrent calls with one params object apart', async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    const befores: unknown[] = []
    recordAfter(service, 'patch', async (context) => {
      const [{ before, result }] = await stashed(context)
      befores.push([before?.name, result?.name])
    })

    const users = await service.create(
      Array.from({ length: 5 }, (_, i) => ({ name: `${i}` })),
    )
    const params = {}
    await Promise.all(
      users.map((user) => service.patch(user.id, { done: true }, params)),
    )

    expect(befores.sort()).toStrictEqual(
      users.map(({ name }) => [name, name]).sort(),
    )
  })

  it("doesn't hand the stash to a nested call", async () => {
    const { app, service } = setup()
    app.use('others', new MemoryService<User>({ multi: true, startId: 1 }))
    const others = app.service('others')
    let nested: Promise<unknown> | undefined
    others.hooks({
      after: { patch: [(context) => void (nested = stashed(context))] },
    })
    service.hooks({
      before: {
        patch: [
          stash,
          async (context) => {
            await others.patch(1, { name: 'nested' }, { ...context.params })
          },
        ],
      },
    })

    await others.create({ name: 'other' })
    const user = await service.create({ name: 'a' })
    await service.patch(user.id, { name: 'b' })

    await expect(nested).rejects.toThrow(/nothing is stashed/)
  })

  it("doesn't let the hooks of the fetches write into the params of the call", async () => {
    const { service } = setup()
    let stateOfCall: unknown
    service.hooks({
      before: {
        // like feathers-casl, which keeps its state on `params.casl`
        find: [
          (context) => {
            ;(context.params as any).state.fromFetch = true
          },
        ],
        patch: [
          stash,
          (context) => {
            stateOfCall = (context.params as any).state
          },
        ],
      },
    })
    recordAfter(service, 'patch', stashed)

    const user = await service.create({ name: 'a' })
    // `$select` makes it refetch after the call as well
    await service.patch(user.id, { name: 'b' }, {
      state: {},
      query: { $select: ['id'] },
    } as any)

    expect(stateOfCall).toStrictEqual({})
  })

  it("leaves the caller's params untouched", async () => {
    const { service } = setup()
    service.hooks({ before: { patch: [stash] } })
    recordAfter(service, 'patch', stashed)
    const user = await service.create({ name: 'a' })

    await expectNoSideEffects({ query: { name: 'a' } }, (params) =>
      service.patch(user.id, { name: 'a' }, params),
    )
  })

  it('fails the call if the fetch fails', async () => {
    const { service } = setup()
    service.hooks({
      before: {
        find: [
          () => {
            throw new Error('fetch failed')
          },
        ],
        patch: [stash],
      },
    })

    const user = await service.create({ name: 'a' })

    await expect(service.patch(user.id, { name: 'b' })).rejects.toThrow(
      'fetch failed',
    )
  })

  describe('throws', () => {
    it('on find and get', async () => {
      const { service } = setup()
      service.hooks({ before: { find: [stash], get: [stash] } })

      await expect(service.find()).rejects.toThrow()
      await expect(service.get(1)).rejects.toThrow()
    })

    it('in an after hook', async () => {
      const { service } = setup()
      service.hooks({ after: { patch: [stash] } })
      const user = await service.create({ name: 'a' })

      await expect(service.patch(user.id, { name: 'b' })).rejects.toThrow()
    })

    it("in an around hook after 'next()'", async () => {
      const { service } = setup()
      service.hooks({
        around: {
          patch: [
            async (context, next) => {
              await next()
              await stash(context)
            },
          ],
        },
      })
      const user = await service.create({ name: 'a' })

      await expect(service.patch(user.id, { name: 'b' })).rejects.toThrow(
        /the call already ran/,
      )
    })

    it("on 'stashed' without 'stash'", async () => {
      const { service } = setup()
      service.hooks({
        after: {
          patch: [
            async (context) => {
              await stashed(context)
            },
          ],
        },
      })
      const user = await service.create({ name: 'a' })

      await expect(service.patch(user.id, { name: 'b' })).rejects.toThrow(
        /nothing is stashed/,
      )
    })
  })
})

describe('defineStash (type tests)', () => {
  it('is a before and an around hook', () => {
    const asBefore: HookFunction = stash
    const asAround: AroundHookFunction = stash
    expect([asBefore, asAround]).toStrictEqual([stash, stash])
  })

  it('types the items', () => {
    const { stashed } = defineStash<User>()
    expectTypeOf(stashed).returns.resolves.toEqualTypeOf<StashedItem<User>[]>()
  })
})
