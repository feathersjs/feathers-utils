import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn } from '../types.js'

/**
 * Resolves an option that is a boolean or a predicate on the context, e.g.
 * `blocking: isProvider('external')`. `fallback` stands in for a missing option.
 *
 * @example
 * ```ts
 * const isBlocking = await resolveBoolean(options.blocking, context, true)
 * ```
 */
export const resolveBoolean = async <H extends HookContext>(
  value: boolean | PredicateFn<H> | undefined,
  context: H,
  fallback: boolean,
): Promise<boolean> =>
  value === undefined
    ? fallback
    : typeof value === 'function'
      ? await value(context)
      : value

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest
  const context = { type: 'before' } as HookContext

  describe('resolveBoolean', () => {
    it('returns a boolean as-is', async () => {
      expect(await resolveBoolean(false, context, true)).toBe(false)
      expect(await resolveBoolean(true, context, false)).toBe(true)
    })

    it('returns the fallback without a value', async () => {
      expect(await resolveBoolean(undefined, context, true)).toBe(true)
      expect(await resolveBoolean(undefined, context, false)).toBe(false)
    })

    it('calls a predicate with the context', async () => {
      const predicate = vi.fn((ctx: HookContext) => ctx.type === 'before')

      expect(await resolveBoolean(predicate, context, false)).toBe(true)
      expect(predicate).toHaveBeenCalledWith(context)
    })

    it('awaits an async predicate', async () => {
      expect(await resolveBoolean(async () => false, context, true)).toBe(false)
    })
  })
}
