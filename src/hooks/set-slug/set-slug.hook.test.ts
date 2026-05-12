import { assert, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'

import { setSlug } from './set-slug.hook.js'

let hook: any

describe('services setSlug', () => {
  beforeEach(() => {
    hook = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest', query: { a: 'a' } },
    }
  })

  describe('ignore feathers-socketio & feathers-rest clients', () => {
    it('ignore feathers-socketio', () => {
      hook.params.provider = 'socketio'
      setSlug('stockId')(hook)
      assert.deepEqual(hook.params.query, { a: 'a' })
    })

    it('ignore feathers-rest', () => {
      hook.params.route = {}
      hook.params.route.storeId = ':storeId'
      setSlug('stockId')(hook)
      assert.deepEqual(hook.params.query, { a: 'a' })
    })
  })

  describe('handles raw HTTP clients', () => {
    it('copies slug to query', () => {
      hook.params.route = {}
      hook.params.route.storeId = '123'
      setSlug('storeId')(hook)
      assert.deepEqual(hook.params.query, { a: 'a', storeId: '123' })
    })
  })

  describe('handles field name', () => {
    it('copies slug to query', () => {
      hook.params.route = {}
      hook.params.route.storeId = '123'
      setSlug('storeId', 'slugger')(hook)
      assert.equal(hook.params.slugger, '123')
    })
  })

  describe('handles field name with dot notation', () => {
    it('copies slug to query', () => {
      hook.params.route = {}
      hook.params.route.storeId = '123'
      setSlug('storeId', 'query.slugger')(hook)
      assert.deepEqual(hook.params.query, { a: 'a', slugger: '123' })
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; storeId?: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(setSlug<Ctx>('storeId')).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('copies slug into params.query on rest provider', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>({ multi: true }))
      app.service('items').hooks({
        around: {
          find: [setSlug<Ctx>('storeId')],
        },
      })

      await app
        .service('items')
        .create([{ storeId: '1' }, { storeId: '2' }] as any)

      const result = (await app.service('items').find({
        provider: 'rest',
        route: { storeId: '1' },
        paginate: false,
      } as any)) as unknown as Item[]
      expect(result).toHaveLength(1)
      expect(result[0].storeId).toBe('1')
    })
  })
})
