import { expectTypeOf } from 'vitest'
import type {
  feathers,
  AroundHookFunction,
  HookContext,
} from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { debug } from './debug.hook.js'

describe('services debug', () => {
  it('does not crash', () => {
    const hook: any = {
      type: 'before',
      method: 'create',
      data: { a: 'a' },
      params: { query: { b: 'b' } },
      result: { c: 'c' },
    }
    debug('my message')(hook)
  })

  it('display params props', () => {
    const hook: any = {
      type: 'before',
      method: 'create',
      data: { a: 'a' },
      params: { query: { b: 'b' }, foo: 'bar' },
      result: { c: 'c' },
    }
    debug('my message', 'query', 'foo')(hook)
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(debug<Ctx>('msg')).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })
  })
})
