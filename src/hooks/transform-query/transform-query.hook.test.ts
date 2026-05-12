import { expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { transformQuery } from './transform-query.hook.js'

describe('transformQuery', () => {
  it('should transform the query object', () => {
    const context = {
      params: {
        query: {
          foo: 'bar',
          baz: 'qux',
        },
      },
    } as HookContext

    const transformer = (query: Record<string, any>) => {
      return {
        ...query,
        transformed: true,
      }
    }

    transformQuery(transformer)(context)

    expect(context.params.query).toEqual({
      foo: 'bar',
      baz: 'qux',
      transformed: true,
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string; active?: boolean }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(transformQuery<any, Ctx>((q) => q)).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('augments query before find', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>({ multi: true }))
      app.service('items').hooks({
        around: {
          find: [transformQuery<any, Ctx>((q) => ({ ...q, active: true }))],
        },
      })

      await app.service('items').create([
        { name: 'a', active: true },
        { name: 'b', active: false },
      ] as any)

      const result = (await app
        .service('items')
        .find({ paginate: false } as any)) as unknown as Item[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('a')
    })
  })
})
