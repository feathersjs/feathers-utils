import { expectTypeOf } from 'vitest'
import { BadRequest, GeneralError } from '@feathersjs/errors'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { throwIf } from './throw-if.hook.js'

describe('throwIf', () => {
  it('throws BadRequest if no error function is provided', async () => {
    await expect(() => throwIf(() => true)({} as HookContext)).rejects.toThrow(
      BadRequest,
    )
  })

  it('should throw an error if the predicate returns true', async () => {
    await expect(() =>
      throwIf(() => true, { error: () => new GeneralError('Test error') })(
        {} as HookContext,
      ),
    ).rejects.toThrow(GeneralError)
  })

  it('async predicate should throw an error if it returns true', async () => {
    await expect(() =>
      throwIf(async () => true, {
        error: () => new GeneralError('Async test error'),
      })({} as HookContext),
    ).rejects.toThrow(GeneralError)
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      expectTypeOf(throwIf<Ctx>(() => false)).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    it('blocks the call when predicate is true', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())
      app.service('items').hooks({
        around: {
          remove: [throwIf<Ctx>((ctx) => ctx.id != null)],
        },
      })

      const created = await app.service('items').create({ name: 'Alice' })
      await expect(app.service('items').remove(created.id)).rejects.toThrow(
        BadRequest,
      )
    })
  })
})
