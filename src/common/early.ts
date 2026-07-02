import type { HookContext } from '@feathersjs/feathers'

/**
 * Can be used to early return a hook.
 *
 * If it's an around hook, it will call `next` if provided.
 */
export const early = <H extends HookContext>(
  context: H,
  next?: (context: H) => void | Promise<void>,
): void | Promise<void> => {
  if (next) {
    return next(context)
  }
  return
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('early', () => {
    it('returns undefined when no next is given', () => {
      expect(early({} as HookContext)).toBeUndefined()
    })

    it('calls next with the context and returns its result', () => {
      const context = { method: 'find' } as HookContext
      let received: HookContext | undefined
      const next = (ctx: HookContext) => {
        received = ctx
        return Promise.resolve()
      }
      const result = early(context, next)
      expect(received).toBe(context)
      expect(result).toBeInstanceOf(Promise)
    })
  })
}
