import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import type { CacheOptions } from './cache.hook.js'
import { cache } from './cache.hook.js'
import { LRUCache } from 'lru-cache'
import { TTLCache } from '@isaacs/ttlcache'
import { MemoryService } from '@feathersjs/memory'
import { expect } from 'vitest'
import { copy } from 'fast-copy'

const setup = (options: CacheOptions, serviceOptions?: { id?: string }) => {
  const app = feathers<{
    users: MemoryService
  }>()
  app.use(
    'users',
    new MemoryService({
      id: serviceOptions?.id ?? 'id',
      paginate: {
        default: 10,
        max: 50,
      },
      multi: true,
    }),
  )

  const usersService = app.service('users')

  const cacheHook = cache(options)

  const before = {
    find: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
  }

  const after = {
    find: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
  }

  usersService.hooks({
    before: {
      find: [
        cacheHook,
        (context: HookContext) => {
          if (context.result) {
            return
          }

          before.find(copy(context))
        },
      ],
      get: [
        cacheHook,
        (context: HookContext) => {
          if (context.result) {
            return
          }

          before.get(copy(context))
        },
      ],
      create: [cacheHook, before.create],
      update: [cacheHook, before.update],
      patch: [cacheHook, before.patch],
      remove: [cacheHook, before.remove],
    },
    after: {
      find: [cacheHook, after.find],
      get: [cacheHook, after.get],
      create: [cacheHook, after.create],
      update: [cacheHook, after.update],
      patch: [cacheHook, after.patch],
      remove: [cacheHook, after.remove],
    },
  })

  return {
    app,
    usersService,
    before,
    after,
    cacheMap: options.map,
  }
}

describe('cache hook', () => {
  describe('get', () => {
    it('basic get cache', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })

      let item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
      expect(before.get.mock.lastCall?.[0].result).toBeUndefined()

      item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1) // Should not call before hook again
    })

    it('does not clear get cache on create', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1) // Should not call before hook again
    })

    it('does clear get cache on patch', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(2)

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(3) // Should call before hook again

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(3)
    })

    it('considers query params in cache', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
      expect(before.get.mock.lastCall?.[0].result).toBeUndefined()

      item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1) // Should not call before hook again

      item = await usersService.get(1, { query: { name: { $in: ['John'] } } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(2) // Should call before hook again
    })
  })

  describe('find', () => {
    it('basic find cache', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)
      expect(before.find.mock.lastCall?.[0].result).toBeUndefined()

      items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1) // Should not call before hook again
    })

    it('paginate does not cache', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items: any = await usersService.find({})
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)
      expect(before.find.mock.lastCall?.[0].result).toBeUndefined()

      items = await usersService.find({ paginate: false })
      expect(items).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(2) // Should not call before hook again
    })

    it('mutations deletes cached find', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 3, name: 'Jack' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(2) // Should call before hook again

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(3) // Should call before hook again

      await usersService.update(1, { name: 'John Smith' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(4) // Should call before hook again

      await usersService.remove(1)
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(5) // Should call before hook again
    })

    it('considers query params in cache', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find({ query: { name: 'John' } })
      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)
      expect(before.find.mock.lastCall?.[0].result).toBeUndefined()

      items = await usersService.find({ query: { name: 'John' } })
      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1) // Should not call before hook again

      items = await usersService.find({ query: { name: { $in: ['John'] } } })
      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(2) // Should call before hook again
    })

    it('cache hit regardless of query property order', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John', age: 30 })
      await usersService.create({ id: 2, name: 'Jane', age: 25 })

      let items = await usersService.find({ query: { name: 'John', age: 30 } })
      expect(items.data).toEqual([{ id: 1, name: 'John', age: 30 }])
      expect(before.find).toHaveBeenCalledTimes(1)

      // Same query but properties in different order
      items = await usersService.find({ query: { age: 30, name: 'John' } })
      expect(items.data).toEqual([{ id: 1, name: 'John', age: 30 }])
      expect(before.find).toHaveBeenCalledTimes(1) // Cache hit
    })

    it('cache hit regardless of $or order', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John', age: 30 })
      await usersService.create({ id: 2, name: 'Jane', age: 25 })

      let items = await usersService.find({
        query: { $or: [{ name: 'John' }, { name: 'Jane' }] },
      })
      expect(items.data).toHaveLength(2)
      expect(before.find).toHaveBeenCalledTimes(1)

      // Same query but $or items in different order
      items = await usersService.find({
        query: { $or: [{ name: 'Jane' }, { name: 'John' }] },
      })
      expect(items.data).toHaveLength(2)
      expect(before.find).toHaveBeenCalledTimes(1) // Cache hit
    })

    it('cache hit regardless of $in order', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find({
        query: { name: { $in: ['John', 'Jane'] } },
      })
      expect(items.data).toHaveLength(2)
      expect(before.find).toHaveBeenCalledTimes(1)

      // Same query but $in items in different order
      items = await usersService.find({
        query: { name: { $in: ['Jane', 'John'] } },
      })
      expect(items.data).toHaveLength(2)
      expect(before.find).toHaveBeenCalledTimes(1) // Cache hit
    })

    it('can transform params', async () => {
      const { usersService, before } = setup({
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => {
          const { paginate, ...rest } = params as any
          return rest
        },
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find({ query: { name: 'John' } })

      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)

      items = (await usersService.find({
        query: { name: 'John' },
        paginate: false,
      })) as any

      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1) // Cache hit, should not call before hook again
    })
  })
})

describe('cache hook with @isaacs/ttlcache', () => {
  describe('get', () => {
    it('basic get cache', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })

      let item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
      expect(before.get.mock.lastCall?.[0].result).toBeUndefined()

      item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
    })

    it('does not clear get cache on create', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)
    })

    it('does clear get cache on patch', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(2)

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(3)

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(3)
    })

    it('considers query params in cache', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)

      item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)

      item = await usersService.get(1, { query: { name: { $in: ['John'] } } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('find', () => {
    it('basic find cache', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)

      items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)
    })

    it('mutations deletes cached find', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 3, name: 'Jack' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(2)

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(3)

      await usersService.update(1, { name: 'John Smith' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(4)

      await usersService.remove(1)
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(5)
    })

    it('can transform params', async () => {
      const { usersService, before } = setup({
        map: new TTLCache({ max: 10, ttl: 60_000 }),
        transformParams: (params) => {
          const { paginate, ...rest } = params as any
          return rest
        },
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find({ query: { name: 'John' } })
      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)

      items = (await usersService.find({
        query: { name: 'John' },
        paginate: false,
      })) as any

      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)
    })
  })
})

describe('cache hook with native Map', () => {
  describe('get', () => {
    it('basic get cache', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })

      let item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
      expect(before.get.mock.lastCall?.[0].result).toBeUndefined()

      item = await usersService.get(1)
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)
    })

    it('does not clear get cache on create', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)
    })

    it('does clear get cache on patch', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(1)

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(2)

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.get(1)
      expect(before.get).toHaveBeenCalledTimes(3)

      await usersService.get(2)
      expect(before.get).toHaveBeenCalledTimes(3)
    })

    it('considers query params in cache', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)

      item = await usersService.get(1, { query: { name: 'John' } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(1)

      item = await usersService.get(1, { query: { name: { $in: ['John'] } } })
      expect(item).toEqual({ id: 1, name: 'John' })
      expect(before.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('find', () => {
    it('basic find cache', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)

      items = await usersService.find()
      expect(items.data).toEqual([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ])
      expect(before.find).toHaveBeenCalledTimes(1)
    })

    it('mutations deletes cached find', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => params,
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(1)

      await usersService.create({ id: 3, name: 'Jack' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(2)

      await usersService.patch(1, { name: 'John Doe' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(3)

      await usersService.update(1, { name: 'John Smith' })
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(4)

      await usersService.remove(1)
      await usersService.find()
      expect(before.find).toHaveBeenCalledTimes(5)
    })

    it('can transform params', async () => {
      const { usersService, before } = setup({
        map: new Map(),
        transformParams: (params) => {
          const { paginate, ...rest } = params as any
          return rest
        },
      })

      await usersService.create({ id: 1, name: 'John' })
      await usersService.create({ id: 2, name: 'Jane' })

      let items = await usersService.find({ query: { name: 'John' } })
      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)

      items = (await usersService.find({
        query: { name: 'John' },
        paginate: false,
      })) as any

      expect(items.data).toEqual([{ id: 1, name: 'John' }])
      expect(before.find).toHaveBeenCalledTimes(1)
    })
  })
})

describe('cache hook logger', () => {
  it('logs miss, set, and hit for get', async () => {
    const logger = vi.fn()
    const { usersService } = setup({
      map: new Map(),
      transformParams: (params) => params,
      logger,
    })

    await usersService.create({ id: 1, name: 'John' })
    logger.mockClear()

    await usersService.get(1)
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger.mock.calls[0][0]).toMatchObject({ type: 'miss', method: 'get' })
    expect(logger.mock.calls[1][0]).toMatchObject({ type: 'set', method: 'get' })

    logger.mockClear()

    await usersService.get(1)
    // hit in before hook, then set again in after hook (re-caches same result)
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger.mock.calls[0][0]).toMatchObject({ type: 'hit', method: 'get' })
    expect(logger.mock.calls[1][0]).toMatchObject({
      type: 'set',
      method: 'get',
    })
  })

  it('logs miss, set, and hit for find', async () => {
    const logger = vi.fn()
    const { usersService } = setup({
      map: new Map(),
      transformParams: (params) => params,
      logger,
    })

    await usersService.create({ id: 1, name: 'John' })
    logger.mockClear()

    await usersService.find()
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger.mock.calls[0][0]).toMatchObject({ type: 'miss', method: 'find' })
    expect(logger.mock.calls[1][0]).toMatchObject({ type: 'set', method: 'find' })

    logger.mockClear()

    await usersService.find()
    // hit in before hook, then set again in after hook (re-caches same result)
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger.mock.calls[0][0]).toMatchObject({ type: 'hit', method: 'find' })
    expect(logger.mock.calls[1][0]).toMatchObject({
      type: 'set',
      method: 'find',
    })
  })

  it('logs invalidate on mutation', async () => {
    const logger = vi.fn()
    const { usersService } = setup({
      map: new Map(),
      transformParams: (params) => params,
      logger,
    })

    await usersService.create({ id: 1, name: 'John' })

    // populate cache
    await usersService.get(1)
    await usersService.find()
    logger.mockClear()

    await usersService.patch(1, { name: 'John Doe' })
    const events = logger.mock.calls.map((c) => c[0])

    const invalidateEvents = events.filter((e: any) => e.type === 'invalidate')
    expect(invalidateEvents.length).toBe(2) // find cache + get cache
    expect(invalidateEvents[0]).toMatchObject({ type: 'invalidate', method: 'patch' })
  })

  it('logs clear when no ids found', async () => {
    const logger = vi.fn()
    const { usersService } = setup({
      map: new Map(),
      transformParams: (params) => params,
      logger,
    })

    await usersService.create({ id: 1, name: 'John' })
    await usersService.find()
    logger.mockClear()

    await usersService.remove(1)
    const events = logger.mock.calls.map((c) => c[0])

    const invalidateEvents = events.filter(
      (e: any) => e.type === 'invalidate' || e.type === 'clear',
    )
    expect(invalidateEvents.length).toBeGreaterThan(0)
  })

  it('includes cache key in events', async () => {
    const logger = vi.fn()
    const { usersService } = setup({
      map: new Map(),
      transformParams: (params) => params,
      logger,
    })

    await usersService.create({ id: 1, name: 'John' })
    logger.mockClear()

    await usersService.get(1)

    const missEvent = logger.mock.calls[0][0]
    expect(missEvent.type).toBe('miss')
    expect(typeof missEvent.key).toBe('string')
    expect(missEvent.key.length).toBeGreaterThan(0)
  })
})

describe('cache hook with custom id', () => {
  it('uses service.options.id for cache invalidation', async () => {
    const { usersService, before } = setup(
      {
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      },
      { id: '_id' },
    )

    await usersService.create({ _id: 'abc', name: 'John' })
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(1)

    // Cached
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(1)

    // Patch should invalidate the get cache for 'abc'
    await usersService.patch('abc', { name: 'John Doe' })
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(2)
  })

  it('uses options.id as fallback', async () => {
    const { usersService, before } = setup(
      {
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
        id: '_id',
      },
      { id: '_id' },
    )

    await usersService.create({ _id: 'abc', name: 'John' })
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(1)

    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(1)

    await usersService.patch('abc', { name: 'John Doe' })
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(2)
  })

  it('does not clear unrelated get cache on patch with custom id', async () => {
    const { usersService, before } = setup(
      {
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      },
      { id: '_id' },
    )

    await usersService.create({ _id: 'abc', name: 'John' })
    await usersService.create({ _id: 'def', name: 'Jane' })

    await usersService.get('abc')
    await usersService.get('def')
    expect(before.get).toHaveBeenCalledTimes(2)

    await usersService.patch('abc', { name: 'John Doe' })

    // 'def' should still be cached
    await usersService.get('def')
    expect(before.get).toHaveBeenCalledTimes(2)

    // 'abc' should be invalidated
    await usersService.get('abc')
    expect(before.get).toHaveBeenCalledTimes(3)
  })

  it('invalidates find cache on mutation with custom id', async () => {
    const { usersService, before } = setup(
      {
        map: new LRUCache({ max: 10 }),
        transformParams: (params) => params,
      },
      { id: '_id' },
    )

    await usersService.create({ _id: 'abc', name: 'John' })
    await usersService.find()
    expect(before.find).toHaveBeenCalledTimes(1)

    await usersService.patch('abc', { name: 'John Doe' })
    await usersService.find()
    expect(before.find).toHaveBeenCalledTimes(2)
  })
})

describe('cache hook with custom serialize', () => {
  it('uses custom serialize for cache keys', async () => {
    const serialize = vi.fn((params) => JSON.stringify(params))

    const { usersService, before } = setup({
      map: new LRUCache({ max: 10 }),
      transformParams: (params) => ({ query: params.query }),
      serialize,
    })

    await usersService.create({ id: 1, name: 'John' })

    await usersService.get(1)
    expect(serialize).toHaveBeenCalled()
    expect(before.get).toHaveBeenCalledTimes(1)

    await usersService.get(1)
    expect(before.get).toHaveBeenCalledTimes(1) // Cache hit
  })

  it('different serialize produces different keys', async () => {
    // A serialize that ignores query entirely
    const { usersService, before } = setup({
      map: new LRUCache({ max: 10 }),
      transformParams: (params) => params,
      serialize: () => 'constant',
    })

    await usersService.create({ id: 1, name: 'John' })

    await usersService.find({ query: { name: 'John' } })
    expect(before.find).toHaveBeenCalledTimes(1)

    // Different query but same serialize output => cache hit
    await usersService.find({ query: { name: 'Jane' } })
    expect(before.find).toHaveBeenCalledTimes(1)
  })
})
