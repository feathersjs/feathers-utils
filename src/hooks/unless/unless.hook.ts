import type { HookContext } from '@feathersjs/feathers'
import { iffElse } from '../iff-else/iff-else.hook.js'
import type { PredicateFn, HookFunction } from '../../types.js'

/**
 * Execute a series of hooks if a sync or async predicate is falsey.
 *
 * @see https://utils.feathersjs.com/hooks/unless.html
 */
export function unless<H extends HookContext = HookContext>(
  predicate: boolean | PredicateFn,
  ...hooks: HookFunction<H>[]
) {
  return iffElse(predicate, undefined, [...hooks])
}
