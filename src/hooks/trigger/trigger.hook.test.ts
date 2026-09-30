import type {
  Application,
  AroundHookFunction,
  HookContext,
  HookFunction,
} from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { Mock } from 'vitest'
import { expectTypeOf } from 'vitest'
import { isContext } from '../../predicates/is-context/is-context.predicate.js'
import { recordHooks } from '../../testing/index.js'
import type { StashedItem } from '../../utils/define-stash/define-stash.util.js'
import { trigger } from './trigger.hook.js'
import type { TriggerOptions } from './trigger.hook.js'

type Item = {
  id: number
  test?: boolean
  count?: number
  name?: string
  date?: string
  done?: boolean
}
type App = Application<{ tests: MemoryService<Item> }>
type TestsContext = HookContext<App, MemoryService<Item>>

type Mode = 'before-after' | 'around'
const modes: Mode[] = ['before-after', 'around']

const allMethods = ['create', 'update', 'patch', 'remove'] as const

const [startsWithA, startsWithB] = [/^a/, /^b/]

/** registers `hooks` on `methods`, as around or as before and after hooks */
const register = (
  service: any,
  mode: Mode,
  hooks: any[],
  methods: readonly string[] = allMethods,
) => {
  const map = Object.fromEntries(methods.map((method) => [method, hooks]))
  service.hooks(
    mode === 'around' ? { around: map } : { before: map, after: map },
  )
}

const setup = (
  mode: Mode,
  options: TriggerOptions<any, any>,
  methods?: readonly string[],
) => {
  const app = feathers<{ tests: MemoryService<Item> }>()
  app.use('tests', new MemoryService<Item>({ multi: true }))
  const service = app.service('tests')
  const calls = recordHooks(service, {
    type: 'before',
    method: ['find', 'get'],
  })
  register(service, mode, [trigger(options)], methods)
  return { app, service, calls }
}

/** the items the action was called with */
const itemsOf = (action: Mock) =>
  action.mock.calls.map(([item]) => item as StashedItem<Item>)

const addDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

describe('trigger', () => {
  it('throws without options', () => {
    // @ts-expect-error needs subscriptions
    expect(() => trigger()).toThrow()
  })

  modes.forEach((mode) => {
    describe(mode, () => {
      describe('general', () => {
        it('throws on find and get', async () => {
          const { service } = setup(mode, { action: () => {} }, ['find', 'get'])

          await expect(service.find()).rejects.toThrow()
          await expect(service.get(0)).rejects.toThrow()
        })

        it('runs the action on create, update, patch and remove', async () => {
          const action = vi.fn()
          const { service } = setup(mode, { action })

          await service.create({ id: 0, test: true })
          await service.update(0, { id: 0, test: false })
          await service.patch(0, { test: true })
          await service.remove(0)

          expect(itemsOf(action)).toStrictEqual([
            { id: 0, before: undefined, result: { id: 0, test: true } },
            { id: 0, before: undefined, result: { id: 0, test: false } },
            { id: 0, before: undefined, result: { id: 0, test: true } },
            { id: 0, before: undefined, result: { id: 0, test: true } },
          ])
        })

        it('passes the context, all items and the subscription to the action', async () => {
          const action = vi.fn()
          const subscription = { result: (item: Item) => !!item.test, action }
          const { service } = setup(mode, subscription)

          await service.create([
            { id: 0, test: true },
            { id: 1, test: false },
          ])

          expect(action).toHaveBeenCalledTimes(1)
          const [item, options] = action.mock.calls[0]
          expect(item.result).toStrictEqual({ id: 0, test: true })
          expect(options.subscription).toBe(subscription)
          expect(options.context.method).toBe('create')
          expect(options.items.map(({ id }: StashedItem) => id)).toEqual([0, 1])
        })

        it('runs every subscription of an array', async () => {
          const [first, second] = [vi.fn(), vi.fn()]
          const { service } = setup(mode, [
            { action: first },
            { action: second },
          ])

          await service.create({ id: 0 })

          expect(first).toHaveBeenCalledTimes(1)
          expect(second).toHaveBeenCalledTimes(1)
        })

        it('takes the subscriptions from a function, per call', async () => {
          const action = vi.fn()
          const { service } = setup(mode, (context: HookContext) =>
            context.params.provider ? undefined : { action },
          )

          await service.create({ id: 0 })
          await service.create({ id: 1 }, { provider: 'rest' })

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0])
        })

        it('runs the action for every item of a multi patch', async () => {
          const action = vi.fn()
          const { service } = setup(mode, { action })
          await service.create([{ id: 0 }, { id: 1 }])
          action.mockClear()

          await service.patch(null, { done: true })

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0, 1])
        })

        it("doesn't run the action without items", async () => {
          const action = vi.fn()
          const { service } = setup(mode, { action })

          await service.patch(null, { done: true }, { query: { id: 99 } })

          expect(action).not.toHaveBeenCalled()
        })
      })

      describe('iff', () => {
        it('skips the call if false', async () => {
          const action = vi.fn()
          const { service } = setup(mode, { iff: false, action })

          await service.create({ id: 0 })

          expect(action).not.toHaveBeenCalled()
        })

        it('tests the call with a predicate', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            iff: isContext({ path: 'tests', method: 'patch' }),
            action,
          })

          await service.create({ id: 0 })
          await service.patch(0, { test: true })
          await service.remove(0)

          expect(itemsOf(action).map(({ result }) => result)).toStrictEqual([
            { id: 0, test: true },
          ])
        })

        it('tests the params of the call', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            iff: (context: HookContext) => context.params.provider === 'rest',
            action,
          })

          await service.create({ id: 0 })
          await service.create({ id: 1 }, { provider: 'rest' })

          expect(itemsOf(action).map(({ id }) => id)).toEqual([1])
        })
      })

      describe('data', () => {
        it('tests the data of a single call', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })

          await service.create({ id: 0, test: false })
          await service.create({ id: 1, test: true })
          await service.patch(0, { test: true })

          expect(itemsOf(action).map(({ id }) => id)).toEqual([1, 0])
        })

        it('tests every item on multi create', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })

          await service.create([
            { id: 0, test: false },
            { id: 1, test: true },
            { id: 2, test: false },
          ])

          expect(itemsOf(action).map(({ id }) => id)).toEqual([1])
        })

        it('maps the data by its position on multi create without ids', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })

          await service.create([
            { test: false },
            { test: true },
            { test: false },
          ])

          expect(itemsOf(action).map(({ result }) => result)).toStrictEqual([
            { id: 1, test: true },
          ])
        })

        it('maps the data by its id, even if a later hook reorders it', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })
          // runs after the trigger tested `data`
          service.hooks({
            before: {
              create: [
                (context) => {
                  context.data = (context.data as Item[]).toReversed()
                },
              ],
            },
          })

          await service.create([
            { id: 0, test: true },
            { id: 1, test: false },
          ])

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0])
        })

        it('pairs every matching data item with its own result', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })

          await service.create([
            { name: 'a', test: true },
            { name: 'b', test: false },
            { name: 'c', test: true },
            { name: 'd', test: false },
          ])

          expect(
            itemsOf(action).map(({ id, result }) => [id, result?.name]),
          ).toEqual([
            [0, 'a'],
            [2, 'c'],
          ])
        })

        it('pairs the data by its id, even if the service returns the result in another order', async () => {
          class ReversingService extends MemoryService<Item> {
            async _create(data: any, params?: any): Promise<any> {
              const result = await super._create(data, params)
              return Array.isArray(result) ? result.toReversed() : result
            }
          }
          const app = feathers<{ tests: ReversingService }>()
          app.use('tests', new ReversingService({ multi: true }))
          const service = app.service('tests')
          const action = vi.fn()
          register(service, mode, [
            trigger({
              data: (data: Partial<Item>) => data.test === true,
              action,
            }),
          ])

          const result = await service.create([
            { id: 0, name: 'a', test: true },
            { id: 1, name: 'b', test: false },
            { id: 2, name: 'c', test: false },
          ])

          expect(result.map(({ id }) => id)).toEqual([2, 1, 0])
          expect(
            itemsOf(action).map(({ id, result }) => [id, result?.name]),
          ).toEqual([[0, 'a']])
        })

        it("doesn't pair data without ids by position once a later hook removes an item", async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.test === true,
            action,
          })
          // runs after the trigger tested `data`
          service.hooks({
            before: {
              create: [
                (context) => {
                  context.data = (context.data as Item[]).slice(1)
                },
              ],
            },
          })

          await service.create([
            { name: 'a', test: true },
            { name: 'b', test: false },
            { name: 'c', test: true },
          ])

          // by position, the data of `a` would pair with the result of `b`
          expect(action).not.toHaveBeenCalled()
        })

        it("doesn't match without data, e.g. on remove", async () => {
          const action = vi.fn()
          const { service } = setup(mode, { data: () => true, action })

          await service.create({ id: 0 })
          await service.remove(0)

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0])
          expect(action).toHaveBeenCalledTimes(1)
        })
      })

      describe('result, before and change', () => {
        it("tests the item after the call with 'result'", async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            result: (item: Item) => (item.count ?? 0) > 10,
            action,
          })

          await service.create({ id: 0, count: 9 })
          await service.create({ id: 1, count: 12 })

          expect(itemsOf(action)).toStrictEqual([
            { id: 1, before: undefined, result: { id: 1, count: 12 } },
          ])
        })

        it("tests the item before the call with 'before', and fetches it", async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            before: (item: Item) => item.test === true,
            action,
          })

          await service.create({ id: 0, test: true })
          await service.create({ id: 1, test: false })
          await service.patch(null, { test: false })

          expect(itemsOf(action)).toStrictEqual([
            {
              id: 0,
              before: { id: 0, test: true },
              result: { id: 0, test: false },
            },
          ])
        })

        it("compares the items before and after the call with 'change'", async () => {
          const action = vi.fn()
          const { service } = setup(
            mode,
            {
              change: ({ before, result }: StashedItem<Item>) =>
                new Date(result!.date!) < new Date(before!.date!),
              action,
            },
            ['patch'],
          )

          await service.create({ id: 0, date: addDays(0) })
          await service.patch(0, { date: addDays(-2) })
          await service.patch(0, { date: addDays(5) })
          await service.patch(0, { date: addDays(-1) })

          expect(action).toHaveBeenCalledTimes(2)
        })

        it('runs the action only if all conditions match', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            data: (data: Partial<Item>) => data.count !== undefined,
            before: (item: Item) => item.test === true,
            result: (item: Item) => (item.count ?? 0) > 1,
            change: ({ before, result }: StashedItem<Item>) =>
              result!.count! > (before!.count ?? 0),
            action,
          })

          await service.create([
            { id: 0, test: true, count: 1 },
            { id: 1, test: false, count: 1 },
            { id: 2, test: true, count: 5 },
          ])
          action.mockClear()

          await service.patch(null, { count: 3 })

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0])
        })

        it('takes async predicates', async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            result: async (item: Item) => item.test === true,
            action,
          })

          await service.create([
            { id: 0, test: true },
            { id: 1, test: false },
          ])

          expect(itemsOf(action).map(({ id }) => id)).toEqual([0])
        })

        it("gives an item missing before the call no 'before', which 'before' doesn't match", async () => {
          const [withFetch, withBefore] = [vi.fn(), vi.fn()]
          const { service } = setup(
            mode,
            [
              { fetchBefore: true, action: withFetch },
              {
                before: (item: Item) => item.test === true,
                action: withBefore,
              },
            ],
            ['patch'],
          )
          // runs after the trigger fetched the items before
          service.hooks({
            before: {
              patch: [
                async (context) => {
                  await context.service.create({ id: 99, test: true })
                },
              ],
            },
          })
          await service.create({ id: 0, test: true })

          await service.patch(null, { test: false })

          expect(
            itemsOf(withFetch).map(({ id, before }) => [id, before]),
          ).toEqual([
            [0, { id: 0, test: true }],
            [99, undefined],
          ])
          expect(itemsOf(withBefore).map(({ id }) => id)).toEqual([0])
        })
      })

      describe('fetching', () => {
        it("fetches the items before the call only with 'before', 'change' or 'fetchBefore'", async () => {
          const { service, calls } = setup(mode, [
            { action: () => {} },
            { result: () => true, action: () => {} },
          ])
          await service.create({ id: 0 })

          await service.patch(0, { test: true })

          expect(calls.all).toHaveLength(0)
        })

        it('passes the items before to a subscription with fetchBefore next to one without', async () => {
          const [withFetch, without] = [vi.fn(), vi.fn()]
          const { service } = setup(mode, [
            { fetchBefore: true, action: withFetch },
            { action: without },
          ])
          await service.create({ id: 0, test: true })

          await service.patch(0, { test: false })

          expect(itemsOf(withFetch)[1].before).toStrictEqual({
            id: 0,
            test: true,
          })
          expect(itemsOf(without)[1].before).toBe(undefined)
        })

        it("resolves 'fetchBefore' from the context, once per call", async () => {
          // recorded when called: Feathers reuses the context of the call
          const types: string[] = []
          const fetchBefore = vi.fn((context: HookContext) => {
            types.push(context.type)
            return context.params.provider === 'rest'
          })
          const action = vi.fn()
          const { service } = setup(mode, { fetchBefore, action })
          await service.create({ id: 0 })
          types.length = 0

          await service.patch(0, { test: true })
          await service.patch(0, { test: false }, { provider: 'rest' })

          expect(types).toEqual(
            mode === 'around' ? ['around', 'around'] : ['before', 'before'],
          )
          expect(itemsOf(action).map(({ before }) => before)).toStrictEqual([
            undefined,
            undefined,
            { id: 0, test: true },
          ])
        })

        it('shares the fetch between subscriptions with equal params', async () => {
          const { service, calls } = setup(
            mode,
            Array.from({ length: 3 }, () => ({
              fetchBefore: true,
              transformParams: (params: any) => ({
                ...params,
                $populate: true,
              }),
              action: () => {},
            })),
          )
          await service.create({ id: 0 })
          calls.reset()

          await service.patch(0, { test: true })

          // one to fetch the items before the call, one to refetch them after
          expect(calls.before.find).toHaveLength(2)
        })

        it('shares the fetch between trigger hooks', async () => {
          const app = feathers<{ tests: MemoryService<Item> }>()
          app.use('tests', new MemoryService<Item>({ multi: true }))
          const service = app.service('tests')
          const calls = recordHooks(service, {
            type: 'before',
            method: ['find'],
          })
          const [first, second] = [vi.fn(), vi.fn()]
          register(service, mode, [
            trigger({ fetchBefore: true, action: first }),
            trigger({ fetchBefore: true, action: second }),
          ])
          await service.create({ id: 0, test: true })

          await service.patch(0, { test: false })

          expect(calls.before.find).toHaveLength(1)
          expect(itemsOf(second)[1].before).toBe(itemsOf(first)[1].before)
        })

        it("adjusts the params of the fetches with 'transformParams'", async () => {
          const action = vi.fn()
          const { service } = setup(mode, {
            fetchBefore: true,
            transformParams: (params: any) => ({ ...params, $populate: true }),
            action,
          })
          service.hooks({
            after: {
              find: [
                (context) => {
                  if ((context.params as any).$populate) {
                    context.result = (context.result as Item[]).map((item) => ({
                      ...item,
                      populated: true,
                    }))
                  }
                },
              ],
            },
          })
          await service.create({ id: 0 })

          await service.patch(0, { test: true })

          expect(itemsOf(action)[1]).toStrictEqual({
            id: 0,
            before: { id: 0, populated: true },
            result: { id: 0, test: true, populated: true },
          })
        })

        it("passes the whole item with '$select', even if the patch changes a field of the query", async () => {
          const action = vi.fn()
          const { service } = setup(mode, { action })
          await service.create({ id: 0, test: true, name: 'awesome' })
          action.mockClear()

          const result = await service.patch(
            0,
            { test: false },
            { query: { test: true, $select: ['id'] } },
          )

          expect(result).toStrictEqual({ id: 0 })
          expect(itemsOf(action).map(({ result }) => result)).toStrictEqual([
            { id: 0, test: false, name: 'awesome' },
          ])
        })

        it("passes the item as 'transformParams' selects it", async () => {
          const [withSelect, without] = [vi.fn(), vi.fn()]
          const { service } = setup(mode, [
            {
              transformParams: (params: any) => {
                params.query = { ...params.query, $select: ['id'] }
              },
              action: withSelect,
            },
            { action: without },
          ])

          await service.create({ id: 1, test: true, name: 'yippieh' })

          expect(itemsOf(withSelect).map(({ result }) => result)).toStrictEqual(
            [{ id: 1 }],
          )
          expect(itemsOf(without).map(({ result }) => result)).toStrictEqual([
            { id: 1, test: true, name: 'yippieh' },
          ])
        })
      })

      describe('actions', () => {
        it("runs 'batchAction' once with all matching items", async () => {
          const batchAction = vi.fn()
          const subscription = {
            result: (item: Item) => item.test === true,
            batchAction,
          }
          const { service } = setup(mode, subscription)

          await service.create([
            { id: 0, test: true },
            { id: 1, test: false },
            { id: 2, test: true },
          ])

          expect(batchAction).toHaveBeenCalledTimes(1)
          const [items, options] = batchAction.mock.calls[0]
          expect(items.map(({ id }: StashedItem) => id)).toEqual([0, 2])
          expect(options.items).toHaveLength(3)
          expect(options.subscription).toBe(subscription)
        })

        it("doesn't run 'batchAction' without matching items", async () => {
          const batchAction = vi.fn()
          const { service } = setup(mode, { result: () => false, batchAction })

          await service.create([{ id: 0 }, { id: 1 }])

          expect(batchAction).not.toHaveBeenCalled()
        })

        it('waits for the action by default', async () => {
          let done = false
          const { service } = setup(mode, {
            action: async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              done = true
            },
          })

          await service.create({ id: 0 })

          expect(done).toBe(true)
        })

        it("doesn't wait for the action with 'isBlocking: false'", async () => {
          let release!: () => void
          const released = new Promise<void>((resolve) => (release = resolve))
          let done = false
          const { service } = setup(mode, {
            isBlocking: false,
            action: async () => {
              await released
              done = true
            },
          })

          await service.create({ id: 0 })
          expect(done).toBe(false)

          release()
          await released
          await new Promise((resolve) => setTimeout(resolve))
          expect(done).toBe(true)
        })

        it('fails the call if a blocking action fails', async () => {
          const { service } = setup(mode, {
            action: async () => {
              throw new Error('action failed')
            },
          })

          await expect(service.create({ id: 0 })).rejects.toThrow(
            'action failed',
          )
        })

        it('logs the errors of non-blocking actions instead of failing', async () => {
          const error = vi.spyOn(console, 'error').mockImplementation(() => {})
          const failing = new Error('action failed')
          const throwing = new Error('action threw')
          const { service } = setup(mode, [
            {
              name: 'rejects',
              isBlocking: false,
              action: async () => {
                throw failing
              },
            },
            {
              isBlocking: false,
              action: () => {
                throw throwing
              },
            },
            {
              isBlocking: false,
              batchAction: async () => {
                throw failing
              },
            },
          ])

          await expect(service.create({ id: 0 })).resolves.toBeDefined()
          await new Promise((resolve) => setTimeout(resolve))

          expect(error).toHaveBeenCalledTimes(3)
          expect(error).toHaveBeenCalledWith(
            '[feathers-utils trigger]',
            'rejects',
            "service('tests').create()",
            'a non-blocking action failed:',
            failing,
          )
          expect(error.mock.calls.map((call) => call.at(-1))).toEqual([
            failing,
            throwing,
            failing,
          ])
          error.mockRestore()
        })

        it("resolves 'isBlocking' from the context", async () => {
          const doneFor: string[] = []
          const { service } = setup(mode, {
            isBlocking: (context: HookContext) =>
              context.params.provider !== 'rest',
            action: async (_item, { context }) => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              doneFor.push(context.params.provider ?? 'server')
            },
          })

          await service.create({ id: 0 })
          await service.create({ id: 1 }, { provider: 'rest' })

          expect(doneFor).toEqual(['server'])
          await new Promise((resolve) => setTimeout(resolve, 20))
        })
      })

      describe('skipping', () => {
        it("skips a subscription by its name in 'params.skipHooks'", async () => {
          const [skipped, other] = [vi.fn(), vi.fn()]
          const { service } = setup(mode, [
            { name: 'skipMe', action: skipped },
            { name: 'other', action: other },
          ])

          await service.create([{ id: 0 }, { id: 1 }], {
            skipHooks: ['skipMe'],
          } as any)

          expect(skipped).not.toHaveBeenCalled()
          expect(other).toHaveBeenCalledTimes(2)
        })

        it("skips the named subscriptions with 'all'", async () => {
          const [named, unnamed] = [vi.fn(), vi.fn()]
          const { service } = setup(mode, [
            { name: 'named', action: named },
            { action: unnamed },
          ])

          await service.create({ id: 0 }, { skipHooks: ['all'] } as any)

          expect(named).not.toHaveBeenCalled()
          expect(unnamed).toHaveBeenCalledTimes(1)
        })

        it("doesn't fetch for a skipped subscription", async () => {
          const { service, calls } = setup(mode, {
            name: 'skipMe',
            fetchBefore: true,
            action: () => {},
          })
          await service.create({ id: 0 })

          await service.patch(0, { test: true }, {
            skipHooks: ['skipMe'],
          } as any)

          expect(calls.all).toHaveLength(0)
        })
      })

      describe('debug', () => {
        afterEach(() => {
          vi.restoreAllMocks()
        })

        it('logs why a subscription skips an item', async () => {
          const log = vi.spyOn(console, 'log').mockImplementation(() => {})
          const { service } = setup(mode, {
            name: 'sub',
            debug: true,
            data: (data: Partial<Item>) => data.test === true,
            action: () => {},
          })

          await service.create([
            { id: 0, test: true },
            { id: 1, test: false },
          ])

          expect(log).toHaveBeenCalledWith(
            '[feathers-utils trigger]',
            'sub',
            mode === 'around' ? 'around' : 'after',
            "service('tests').create()",
            "skipping because of 'data'",
            1,
          )
        })

        it("doesn't log by default", async () => {
          const log = vi.spyOn(console, 'log').mockImplementation(() => {})
          const { service } = setup(mode, { iff: false, action: () => {} })

          await service.create({ id: 0 })

          expect(log).not.toHaveBeenCalled()
        })
      })

      describe('state of the call', () => {
        it("gives concurrent calls with one params object their own 'before'", async () => {
          const action = vi.fn()
          const { service } = setup(mode, { fetchBefore: true, action })
          const items = await service.create(
            Array.from({ length: 5 }, (_, i) => ({ id: i, name: `${i}` })),
          )
          action.mockClear()

          const params = {}
          await Promise.all(
            items.map((item) => service.patch(item.id, { done: true }, params)),
          )

          expect(
            itemsOf(action)
              .map(({ before, result }) => [before?.name, result?.name])
              .sort(),
          ).toEqual(items.map(({ name }) => [name, name]).sort())
        })

        it("leaves the caller's params untouched", async () => {
          const { service } = setup(mode, {
            fetchBefore: true,
            action: () => {},
          })
          await service.create({ id: 0 })
          const params = { user: { id: 1 } }

          await service.patch(0, { test: true }, params as any)

          expect(params).toStrictEqual({ user: { id: 1 } })
        })

        it("doesn't hand the 'before' of the call to a nested call", async () => {
          const app = feathers<{
            outer: MemoryService<Item>
            inner: MemoryService<Item>
          }>()
          app.use('outer', new MemoryService<Item>({ multi: true }))
          app.use('inner', new MemoryService<Item>({ multi: true }))
          const inner = vi.fn()
          register(app.service('inner'), mode, [
            trigger({ fetchBefore: true, action: inner }),
          ])
          register(app.service('outer'), mode, [
            trigger({ fetchBefore: true, action: () => {} }),
          ])
          await app.service('inner').create({ id: 0, name: 'inner' })
          await app.service('outer').create({ id: 0, name: 'outer' })
          inner.mockClear()
          // registered after the trigger, so the outer 'before' is fetched
          app.service('outer').hooks({
            before: {
              patch: [
                async (context) => {
                  await app
                    .service('inner')
                    .patch(0, { name: 'inner patched' }, { ...context.params })
                },
              ],
            },
          })

          await app.service('outer').patch(0, { name: 'outer patched' })

          expect(
            itemsOf(inner).map(({ before, result }) => [
              before?.name,
              result?.name,
            ]),
          ).toEqual([['inner', 'inner patched']])
        })

        it("doesn't let the hooks of its fetch write into the params of the call", async () => {
          const { service } = setup(mode, {
            fetchBefore: true,
            action: () => {},
          })
          let stateOfCall: unknown
          service.hooks({
            before: {
              // like feathers-casl, which keeps its state on `params.casl`
              find: [
                (context) => {
                  ;(context.params as any).state.fromFetch = true
                },
              ],
            },
            after: {
              patch: [
                (context) => {
                  stateOfCall = (context.params as any).state
                },
              ],
            },
          })
          await service.create({ id: 0 })

          await service.patch(0, { test: true }, { state: {} } as any)

          expect(stateOfCall).toStrictEqual({})
        })
      })

      describe('unusual params', () => {
        it("gives subscriptions with different RegExp queries their own 'before'", async () => {
          const withName = (name: RegExp) => ({
            fetchBefore: true,
            transformParams: (params: any) => ({
              ...params,
              query: { ...params.query, name },
            }),
            action: vi.fn(),
          })
          const [a, b] = [withName(startsWithA), withName(startsWithB)]
          const { service } = setup(mode, [a, b])
          await service.create([
            { id: 0, name: 'a' },
            { id: 1, name: 'b' },
          ])
          a.action.mockClear()
          b.action.mockClear()

          await service.patch(null, { done: true })

          expect(itemsOf(a.action).map(({ id }) => id)).toEqual([0])
          expect(itemsOf(b.action).map(({ id }) => id)).toEqual([1])
        })

        it('works with a BigInt in the query', async () => {
          const action = vi.fn()
          const { service } = setup(mode, { fetchBefore: true, action })
          await service.create([{ id: 0 }, { id: 1 }])
          action.mockClear()

          await service.patch(null, { done: true }, {
            query: { id: { $ne: 99n } },
          } as any)

          expect(action).toHaveBeenCalledTimes(2)
        })

        it('works with self-references and functions on params', async () => {
          class Span {
            tree: { span: Span; children: Span[] }
            constructor() {
              this.tree = { span: this, children: [this] }
            }
            end() {}
          }
          const action = vi.fn()
          const { service } = setup(mode, {
            fetchBefore: true,
            // a fresh span for the fetch, looking just like the one of the call
            transformParams: (params: any) => ({ ...params, span: new Span() }),
            action,
          })
          await service.create({ id: 0, name: 'a' })

          await service.patch(0, { name: 'b' }, { span: new Span() } as any)

          expect(itemsOf(action)[1]).toMatchObject({
            before: { name: 'a' },
            result: { name: 'b' },
          })
        })
      })
    })
  })

  describe('types', () => {
    it('types the items by the service', () => {
      trigger<TestsContext>({
        result: (result) => {
          expectTypeOf(result).toEqualTypeOf<Item>()
          return true
        },
        action: ({ result }) => {
          expectTypeOf(result).toEqualTypeOf<Item | undefined>()
        },
      })
    })

    it("takes either 'action' or 'batchAction'", () => {
      // @ts-expect-error not both
      trigger({ action: () => {}, batchAction: () => {} })
      trigger<TestsContext>({
        // @ts-expect-error `result` is an Item, which has no `nope`
        result: (result) => result.nope,
        action: () => {},
      })
    })

    it('is a before, after and around hook', () => {
      const hook = trigger({ action: () => {} })
      const asHook: HookFunction = hook
      const asAround: AroundHookFunction = hook
      expect([asHook, asAround]).toStrictEqual([hook, hook])
    })
  })
})
