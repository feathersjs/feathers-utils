import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { isPromise } from '../../common/index.js'
import { combine } from '../../utils/combine/combine.util.js'
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
  // fnArgs is [context] for service & permission hooks, [data, connection, context] for event filters
  return function (this: any, ctx: H, next?: NextFunction) {
    const trueHooks = Array.isArray(trueHook)
      ? trueHook
      : typeof trueHook === 'function'
        ? [trueHook]
        : undefined

    const falseHooks = Array.isArray(falseHook)
      ? falseHook
      : typeof falseHook === 'function'
        ? [falseHook]
        : undefined

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

function callHooks<H extends HookContext = HookContext>(
  this: any,
  ctx: H,
  serviceHooks: HookFunction<H>[],
  next?: NextFunction,
) {
  if (!serviceHooks) {
    if (next) return next()
    return ctx
  }

  const result = combine(...serviceHooks).call(this, ctx)

  if (!next) return result

  return Promise.resolve(result).then(() => next())
}
