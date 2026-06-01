import { expect } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { or as some } from './or.predicate.js'
import { or, some as someAlias } from '../index.js'

describe('predicates/or', () => {
  it('is exported as "some" alias', () => {
    expect(someAlias).toBe(or)
  })

  it('returns false synchronously when empty (OR identity)', () => {
    expect(some()({} as HookContext)).toBe(false)
  })

  it('returns false when all are undefined', () => {
    expect(some(undefined, undefined, undefined)({} as HookContext)).toBe(false)
  })

  it('returns true synchronously for a truthy (non-boolean) result', () => {
    expect(some((() => 1) as any)({} as HookContext)).toBe(true)
    expect(some((() => 'x') as any)({} as HookContext)).toBe(true)
  })

  it('returns false synchronously when all sync results are falsy', () => {
    expect(
      some(
        (() => 0) as any,
        (() => '') as any,
        (() => null) as any,
      )({} as HookContext),
    ).toBe(false)
  })

  it('returns true synchronously when at least 1 hook is true', () => {
    expect(
      some(
        () => false,
        () => false,
        () => Promise.resolve(false),
        () => Promise.resolve(true),
        () => true,
      )({} as HookContext),
    ).toBe(true)
  })

  it('returns true when at least 1 async hook is true', async () => {
    await expect(
      some(
        () => false,
        () => Promise.resolve(false),
        () => Promise.resolve(true),
      )({} as HookContext),
    ).resolves.toBe(true)
  })

  it('rejects with the error', async () => {
    await expect(
      async () =>
        await some(() => Promise.reject(new Error('errored')))(
          {} as HookContext,
        ),
    ).rejects.toThrow('errored')
  })

  it('does not run all predicates when one is true', () => {
    const fn = vi.fn(() => {
      return true
    })

    expect(some(fn, fn, fn)({} as HookContext)).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('when all hooks are falsey', async () => {
    await expect(
      some(
        () => false,
        () => Promise.resolve(false),
        (() => null) as any,
        (() => undefined) as any,
        (() => 0) as any,
      )({} as HookContext),
    ).resolves.toBe(false)
  })
})
