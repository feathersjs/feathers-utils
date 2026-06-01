import { expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { shouldSkip } from '../../predicates/should-skip/should-skip.predicate.js'
import { skippable } from './skippable.hook.js'

describe('skippable', () => {
  it('runs hook when not skipped', async () => {
    const fn = vi.fn((context) => {
      context.result = { data: 'test' }
    })

    const hook = {
      type: 'before',
      method: 'create',
      params: { skipHooks: [] },
    }
    const context = { ...hook, result: null as any }

    const skippableHook = skippable(fn, shouldSkip('testHook'))

    await skippableHook(context)

    expect(context.result).toEqual({ data: 'test' })
    expect(fn).toHaveBeenCalledOnce()
  })

  it('skips for hookName in skipHooks', async () => {
    const fn = vi.fn()
    const hookName = 'testHook'

    await skippable(
      fn,
      shouldSkip(hookName),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: [hookName] },
    })

    expect(fn).not.toHaveBeenCalled()
  })

  it('skips for ["all"] in skipHooks', async () => {
    const fn = vi.fn()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: ['all'] },
    })

    expect(fn).not.toHaveBeenCalled()
  })

  it('skips for context.type in skipHooks', async () => {
    const fn = vi.fn()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: ['before'] },
    })

    expect(fn).not.toHaveBeenCalled()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'after',
      method: 'create',
      params: { skipHooks: ['after'] },
    })
    expect(fn).not.toHaveBeenCalled()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'error',
      method: 'create',
      params: { skipHooks: ['error'] },
    })

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'around',
      method: 'create',
      params: { skipHooks: ['around'] },
    })
  })

  it('skips for "type:hookName" in skipHooks', async () => {
    const fn = vi.fn()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: ['before:testHook'] },
    })

    expect(fn).not.toHaveBeenCalled()

    await skippable(
      fn,
      shouldSkip('testHook'),
    )({
      type: 'after',
      method: 'create',
      params: { skipHooks: ['before:testHook'] },
    })

    expect(fn).toHaveBeenCalled()
  })

  it('awaits an async inner hook in before mode', async () => {
    let resolved = false
    const inner = async (_ctx: any) => {
      await new Promise((r) => setTimeout(r, 5))
      resolved = true
    }

    await skippable(
      inner,
      shouldSkip('testHook'),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: [] },
    } as any)

    // Without returning the inner hook's promise, this resolves before the
    // inner async work completes and `resolved` would still be false.
    expect(resolved).toBe(true)
  })

  it('propagates a returned context in before mode', async () => {
    const replaced = {
      type: 'before',
      method: 'create',
      params: {},
      replaced: true,
    }
    const inner = ((_ctx: any) => replaced) as any

    const result: any = await skippable(
      inner,
      shouldSkip('testHook'),
    )({
      type: 'before',
      method: 'create',
      params: { skipHooks: [] },
    } as any)

    expect(result).toBe(replaced)
  })

  describe('around hooks', () => {
    it('calls next() when skipped', async () => {
      const fn = vi.fn()
      const next = vi.fn()

      await skippable(fn, shouldSkip('testHook'))(
        {
          type: 'around',
          method: 'create',
          params: { skipHooks: ['all'] },
        },
        next,
      )

      expect(fn).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledOnce()
    })

    it('passes next() through to wrapped hook when not skipped', async () => {
      const fn = vi.fn((_context, next) => next())
      const next = vi.fn()

      await skippable(fn, shouldSkip('testHook'))(
        {
          type: 'around',
          method: 'create',
          params: { skipHooks: [] },
        },
        next,
      )

      expect(fn).toHaveBeenCalledOnce()
      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() when async predicate returns true', async () => {
      const fn = vi.fn()
      const next = vi.fn()
      const asyncSkip = () => Promise.resolve(true)

      await skippable(fn, asyncSkip)(
        {
          type: 'around',
          method: 'create',
          params: {},
        },
        next,
      )

      expect(fn).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledOnce()
    })
  })

  describe('integration with service.hooks({ around })', () => {
    type Item = { id: number; name: string; marked?: boolean }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    it('is type-compatible with AroundHookFunction', () => {
      const inner = (_ctx: Ctx) => {}
      expectTypeOf(skippable<Ctx>(inner, shouldSkip('inner'))).toExtend<
        AroundHookFunction<App, MemoryService<Item>>
      >()
    })

    const innerHook = (ctx: Ctx, next?: any) => {
      ;(ctx.data as Item).marked = true
      if (next) return next()
    }

    it('skips wrapped hook when skipHooks matches', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())

      app.service('items').hooks({
        around: {
          create: [skippable<Ctx>(innerHook, shouldSkip('inner'))],
        },
      })

      const created = await app
        .service('items')
        .create({ name: 'Alice' }, { skipHooks: ['inner'] } as any)
      expect(created.marked).toBeUndefined()
    })

    it('runs wrapped hook when not skipped', async () => {
      const app = feathers<Services>()
      app.use('items', new MemoryService<Item>())

      app.service('items').hooks({
        around: {
          create: [skippable<Ctx>(innerHook, shouldSkip('inner'))],
        },
      })

      const created = await app.service('items').create({ name: 'Alice' })
      expect(created.marked).toBe(true)
    })
  })
})
