import { BadRequest } from '@feathersjs/errors'
import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { check } from './check.hook.js'
import type { CheckOptions } from './check.hook.js'

type Event = {
  id: number
  title: string
  startDate: number
  endDate: number
}

const dateRange = (options?: Partial<CheckOptions<HookContext, Event>>) => {
  const test = vi.fn(
    ({ startDate, endDate }: Partial<Event>) => startDate! <= endDate!,
  )
  const hook = check<HookContext, Event>({
    name: 'dateRange',
    from: ['startDate', 'endDate'],
    test,
    ...options,
  })
  return { hook, test }
}

const setup = async (options?: Partial<CheckOptions<HookContext, Event>>) => {
  const app = feathers<{ events: MemoryService<Event> }>()
  app.use('events', new MemoryService<Event>({ startId: 1, multi: true }))
  const events = app.service('events')
  await events.create([
    { title: 'a', startDate: 10, endDate: 20 },
    { title: 'b', startDate: 30, endDate: 40 },
  ])

  const { hook, test } = dateRange(options)
  events.hooks({
    before: { create: [hook], update: [hook], patch: [hook] },
  })

  const find = vi.spyOn(events, 'find')
  return { events, test, find }
}

describe('check', () => {
  describe('create and update', () => {
    it('lets items pass that pass the test', async () => {
      const { events } = await setup()

      await expect(
        events.create({ title: 'c', startDate: 1, endDate: 2 }),
      ).resolves.toMatchObject({ id: 3 })
    })

    it('throws a BadRequest for an item that does not', async () => {
      const { events } = await setup()

      const error = await events
        .create({ title: 'c', startDate: 2, endDate: 1 })
        .catch((error) => error)

      expect(error).toBeInstanceOf(BadRequest)
      expect(error.message).toBe("Check 'dateRange' failed")
      expect(error.data).toEqual({ check: 'dateRange' })
    })

    it('throws for one failing item of a multi create, before anything is written', async () => {
      const { events } = await setup()

      await expect(
        events.create([
          { title: 'c', startDate: 1, endDate: 2 },
          { title: 'd', startDate: 2, endDate: 1 },
        ]),
      ).rejects.toBeInstanceOf(BadRequest)
      expect(await events.find({ query: { title: 'c' } })).toEqual([])
    })

    it('checks update, from data', async () => {
      const { events, find } = await setup()

      await expect(
        events.update(1, { title: 'a', startDate: 50, endDate: 20 }),
      ).rejects.toBeInstanceOf(BadRequest)
      expect(find).not.toHaveBeenCalled()
    })

    it('passes the from fields and the context to test', async () => {
      const { events, test } = await setup()

      await events.create(
        { title: 'c', startDate: 1, endDate: 2 },
        { provider: 'rest' },
      )

      expect(test).toHaveBeenCalledWith(
        { startDate: 1, endDate: 2 },
        expect.objectContaining({ method: 'create' }),
      )
    })
  })

  describe('patch', () => {
    it('neither tests nor fetches without a from field', async () => {
      const { events, test, find } = await setup()

      await events.patch(1, { title: 'x' })

      expect(test).not.toHaveBeenCalled()
      expect(find).not.toHaveBeenCalled()
    })

    it('checks against the stored fields data lacks', async () => {
      const { events, find } = await setup()

      // the stored `startDate` is 10
      await expect(events.patch(1, { endDate: 5 })).rejects.toBeInstanceOf(
        BadRequest,
      )
      expect(find).toHaveBeenCalledWith({
        query: { id: 1, $select: ['id', 'startDate', 'endDate'] },
        paginate: false,
      })
    })

    it('does not test when the from fields stay as they are', async () => {
      const { events, test } = await setup()

      await events.patch(1, { endDate: 20, title: 'x' })

      expect(test).not.toHaveBeenCalled()
    })

    it('fetches the whole items with select: false', async () => {
      const { events, find } = await setup({ select: false })

      await events.patch(1, { endDate: 25 })

      expect(find).toHaveBeenCalledWith({ query: { id: 1 }, paginate: false })
    })
  })

  describe('multi patch', () => {
    it('throws if one item fails', async () => {
      const { events } = await setup()

      // passes for item 1 (10 <= 25), not for item 2 (30 > 25)
      await expect(
        events.patch(null, { endDate: 25 }, { query: {} }),
      ).rejects.toBeInstanceOf(BadRequest)
      expect(await events.get(1)).toMatchObject({ endDate: 20 })
    })
  })

  it('throws its error, with the failing item', async () => {
    const error = vi.fn(() => new BadRequest('end before start'))
    const { events } = await setup({ error })

    await expect(events.patch(2, { endDate: 1 })).rejects.toThrow(
      'end before start',
    )
    expect(error).toHaveBeenCalledWith(
      { id: 2, data: { startDate: 30, endDate: 1 } },
      expect.objectContaining({ method: 'patch' }),
    )
  })

  it('counts equal class instances, like an ObjectId, as unchanged', async () => {
    // keeps its value in an own field, like a bson ObjectId
    class Id {
      constructor(public buffer: string) {}
    }
    const test = vi.fn(() => true)
    // returns class instances, as mongodb does - the memory adapter doesn't
    const service = {
      find: async () => [{ id: 1, ownerId: new Id('a'), title: 'x' }],
      patch: async () => ({}),
    }

    await runHook(check({ from: ['ownerId', 'title'], test }), {
      type: 'before',
      method: 'patch',
      id: 1,
      data: { ownerId: new Id('a') },
      service,
    })

    expect(test).not.toHaveBeenCalled()
  })

  it('awaits an async test', async () => {
    const { hook } = dateRange({
      test: async ({ startDate, endDate }) => startDate! <= endDate!,
    })

    await expect(
      runHook(hook, {
        type: 'before',
        method: 'create',
        data: { startDate: 2, endDate: 1 },
      }),
    ).rejects.toBeInstanceOf(BadRequest)
  })

  it('works as an around hook', async () => {
    const { hook } = dateRange()

    await expect(
      runHook(hook, {
        type: 'around',
        method: 'create',
        data: { startDate: 2, endDate: 1 },
      }),
    ).rejects.toBeInstanceOf(BadRequest)
  })

  it('names no check when it has no name', async () => {
    const { hook } = dateRange({ name: undefined })

    await expect(
      runHook(hook, {
        type: 'before',
        method: 'create',
        data: { startDate: 2, endDate: 1 },
      }),
    ).rejects.toThrow('Check failed')
  })

  it('throws outside before and around hooks, and for other methods', async () => {
    const { hook } = dateRange()

    await expect(
      runHook(hook, { type: 'after', method: 'create', data: {} }),
    ).rejects.toThrow("The 'check' hook has invalid context")
    await expect(
      runHook(hook, { type: 'before', method: 'find' }),
    ).rejects.toThrow("The 'check' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const data = await expectNoSideEffects(
      { params: { query: { $select: ['id'] } }, data: { endDate: 25 } },
      async ({ params, data }) => {
        const service = new MemoryService<Event>({ startId: 1 })
        await service.create({ title: 'a', startDate: 10, endDate: 20 })

        const context = await runHook(dateRange().hook, {
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

    expect(data).toEqual({ endDate: 25 })
  })
})
