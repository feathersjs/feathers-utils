import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'
import { BadRequest, type FeathersError } from '@feathersjs/errors'
import { every, isMulti } from '../../predicates/index.js'
import { throwIf } from '../throw-if/throw-if.hook.js'

export type ThrowIfIsMultiOptions = {
  /**
   * A predicate function to filter the contexts that should be checked for multi operations.
   * If provided, only contexts that pass this predicate will be checked for multi operations.
   */
  filter?: PredicateFn
  /**
   * Customize the error that is thrown if the context is multi and the service does not allow it.
   * If not provided, throws a `BadRequest` error.
   */
  error?: (context: HookContext) => FeathersError
}

const defaultError = (context: HookContext) =>
  new BadRequest(`Cannot perform multi operation on method '${context.method}'`)

/**
 * Throw an error if the context is multi. You can use this to early return if a user provides an array on create or id:null on patch or remove.
 *
 * @see https://utils.feathersjs.com/hooks/throw-if-is-multi.html
 */
export const throwIfIsMulti = <H extends HookContext = HookContext>(
  options?: ThrowIfIsMultiOptions,
) =>
  throwIf<H>(
    every(
      every(isMulti, (context) => context.method !== 'find'),
      options?.filter,
    ),
    {
      error: options?.error ?? defaultError,
    },
  )
