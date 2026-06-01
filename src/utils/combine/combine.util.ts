import type { HookContext } from '@feathersjs/feathers'
import type { HookFunction } from '../../types.js'
import { isPromise } from '../../common/index.js'

/**
 * Sequentially executes multiple hooks, passing the updated context from one to the next.
 * Returns a single hook function that runs the entire chain. If any hook throws,
 * the error is annotated with the current hook context.
 *
 * @example
 * ```ts
 * import { combine } from 'feathers-utils/hooks'
 *
 * const combinedHook = combine(hookA(), hookB(), hookC())
 * app.service('users').hooks({ before: { create: [combinedHook] } })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/combine.html
 */
export function combine<H extends HookContext = HookContext>(
  ...serviceHooks: HookFunction<H>[]
) {
  const isContext = function (ctx: H) {
    return typeof ctx?.method === 'string' && typeof ctx?.type === 'string'
  }

  return async function (context: H) {
    let ctx = context

    const updateCurrentHook = (current: void | H) => {
      // Either use the returned hook object or the current
      // hook object from the chain if the hook returned undefined
      if (current) {
        if (!isContext(current)) {
          throw new Error(
            `${ctx.type} hook for '${ctx.method}' method returned invalid hook object`,
          )
        }

        ctx = current
      }

      return ctx
    }

    // Run the hooks sequentially, only awaiting when a hook is actually async.
    // Avoids a microtask hop per hook and a per-hook `bind` allocation.
    try {
      for (const fn of serviceHooks) {
        // @ts-expect-error `this` is the bound service-hook context
        const currentCtx = fn.call(this, ctx)
        updateCurrentHook(isPromise(currentCtx) ? await currentCtx : currentCtx)
      }
      return ctx
    } catch (error: any) {
      // Add the hook information to any errors
      error.hook = ctx
      throw error
    }
  }
}
