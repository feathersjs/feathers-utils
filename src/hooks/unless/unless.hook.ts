import type { HookContext } from '@feathersjs/feathers'
import { iffElse } from '../iff-else/iff-else.hook.js'
import type { PredicateFn, HookFunction } from '../../types.js'

/**
 * Executes a series of hooks when the predicate is falsy --- the inverse of `iff`.
 * The predicate can be a boolean or a sync/async function.
 * Useful for applying hooks to all contexts except those matching a condition.
 *
 * @example
 * ```ts
 * import { unless, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [unless(isProvider('server'), authenticate('jwt'))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/unless.html
 */
export function unless<H extends HookContext = HookContext>(
  predicate: boolean | PredicateFn,
  ...hooks: HookFunction<H>[]
) {
  return iffElse(predicate, undefined, [...hooks])
}
