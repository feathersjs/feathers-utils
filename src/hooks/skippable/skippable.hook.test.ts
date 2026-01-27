import { shouldSkip } from '../../predicates/should-skip/should-skip.predicate.js'
import { skippable } from './skippable.hook.js'

describe('skippable', () => {
  it('runs hook when not skipped', async () => {
    const fn = vi.fn((context) => {
      context.result = { data: 'test' }
      return context
    })

    const hook = {
      type: 'before',
      method: 'create',
      params: { skipHooks: [] },
    }
    const context = { ...hook, result: null }

    const skippableHook = skippable(fn, shouldSkip('testHook'))

    const result = await skippableHook(context)

    expect(result).toEqual({ ...context, result: { data: 'test' } })
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
})
