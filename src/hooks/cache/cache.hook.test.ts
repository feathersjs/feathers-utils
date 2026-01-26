import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import type { CacheOptions } from './cache.hook.js'
import { cache } from './cache.hook.js'
import { LRUCache } from 'lru-cache'
import { MemoryService } from '@feathersjs/memory'
import { expect } from 'vitest'
import { copy } from 'fast-copy'

const setup = (options: CacheOptions) => {
  const app = feathers<{
    users: MemoryService
  }>()
  app.use(
    'users',
    new MemoryService({
      id: 'id',
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
