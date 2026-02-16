import type { HookContext } from '@feathersjs/feathers'
import { iffElse } from '../iff-else/iff-else.hook.js'
import type { HookFunction, PredicateFn } from '../../types.js'

export interface IffHook<
  H extends HookContext = HookContext,
> extends HookFunction<H> {
  else(...hooks: HookFunction<H>[]): HookFunction<H>
}

/**
 * Conditionally executes a series of hooks when the predicate is truthy.
 * The predicate can be a boolean value or a sync/async function.
 * Supports an `.else(...)` chain for the falsy branch. Also exported as `when`.
 *
 * @example
 * ```ts
 * import { iff, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: {
 *     find: [iff(isProvider('external'), authenticate('jwt'))]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/iff.html
 */
export function iff<H extends HookContext = HookContext>(
  predicate: boolean | PredicateFn<H>,
  ...hooks: HookFunction<H>[]
): IffHook<H> {
  if (hooks.length && Array.isArray(hooks[0])) {
    hooks = hooks[0]
  }

  const iffWithoutElse = function (context: H) {
    return iffElse(predicate, hooks.slice())(context)
  }

  iffWithoutElse.else =
    (...falseHooks: any[]) =>
    (context: H) =>
      iffElse(predicate, hooks.slice(), falseHooks.slice())(context)

  return iffWithoutElse as IffHook<H>
}

export { iff as when }
