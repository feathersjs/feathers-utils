import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { isPromise } from '../../common/index.js'
import { combine } from '../combine/combine.hook.js'
import type { HookFunction, PredicateFn } from '../../types.js'

/**
 * Executes one array of hooks when the predicate is truthy, or another array when it is falsy.
 * The predicate can be a boolean or a sync/async function.
 * Unlike `iff`, both branches are provided upfront without chaining.
 *
 * @example
 * ```ts
 * import { iffElse, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: {
 *     find: [iffElse(isProvider('external'), [hook1()], [hook2()])]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/iff-else.html
 */
export function iffElse<H extends HookContext = HookContext>(
  predicate: boolean | PredicateFn<H>,
  trueHook: HookFunction<H> | HookFunction<H>[] | undefined,
  falseHook?: HookFunction<H> | HookFunction<H>[] | undefined,
) {
  // combined once here instead of on every call
  const trueHooks = toCombined(trueHook)
  const falseHooks = toCombined(falseHook)

  // fnArgs is [context] for service & permission hooks, [data, connection, context] for event filters
  return function (this: any, ctx: H, next?: NextFunction) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this
    const check =
      typeof predicate === 'function'
        ? predicate.apply(that, [ctx])
        : !!predicate

    if (!isPromise(check)) {
      return callHooks.call(
        that,
        ctx,
        (check ? trueHooks : falseHooks) as any,
        next,
      )
    }

    return check.then((check1: any) => {
      const hooks = check1 ? trueHooks : falseHooks
      return callHooks.call(that, ctx, hooks as any, next)
    })
  }
}

function toCombined<H extends HookContext>(
  hook: HookFunction<H> | HookFunction<H>[] | undefined,
): ((this: any, ctx: H) => Promise<H>) | undefined {
  if (Array.isArray(hook)) return combine(...hook)
  if (typeof hook === 'function') return combine(hook)
  return undefined
}

function callHooks<H extends HookContext = HookContext>(
  this: any,
  ctx: H,
  combined: ((this: any, ctx: H) => Promise<H>) | undefined,
  next?: NextFunction,
) {
  if (!combined) {
    if (next) return next()
    return ctx
  }

  const result = combined.call(this, ctx)

  if (!next) return result

  return Promise.resolve(result).then(() => next())
}
