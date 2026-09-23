import { expectTypeOf } from 'vitest'
import type {
  feathers,
  AroundHookFunction,
  HookContext,
} from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { debug } from './debug.hook.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

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

  it('does not mutate params', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await expectNoSideEffects(
      { query: { name: 'Jane' }, user: { id: 1 } },
      (params) =>
        debug(
          'message',
          'user',
        )({ type: 'after', method: 'find', params } as any),
    )
    log.mockRestore()
  })
})
