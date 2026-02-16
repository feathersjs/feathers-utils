import type { HookContext } from '@feathersjs/feathers'
import type { PredicateFn, TransportName } from '../../types.js'
import { throwIf } from '../throw-if/throw-if.hook.js'
import { every, isProvider } from '../../predicates/index.js'
import type { FeathersError } from '@feathersjs/errors'
import { MethodNotAllowed } from '@feathersjs/errors'
import { toArray } from '../../internal.utils.js'

const defaultError = (context: HookContext) =>
  new MethodNotAllowed(
    `Provider '${context.params.provider}' can not call '${context.method}'.`,
  )

export type ThrowIfIsIsProviderOptions = {
  filter?: PredicateFn
  /**
   * Customize the error that is thrown if the context is a provider and the service does not allow it.
   * If not provided, throws a `MethodNotAllowed` error.
   */
  error?: (context: HookContext) => FeathersError
}

/**
 * Throws a `MethodNotAllowed` error when the request comes from one of the specified transports.
 * Combines `throwIf` with the `isProvider` predicate for a convenient one-liner.
 * Use this to restrict methods to server-only or specific transport types.
 *
 * @example
 * ```ts
 * import { throwIfIsProvider } from 'feathers-utils/hooks'
 *
 * app.service('internal').hooks({
 *   before: { all: [throwIfIsProvider('external')] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/throw-if-is-provider.html
 */
export const throwIfIsProvider = <H extends HookContext = HookContext>(
  transports: TransportName | TransportName[],
  options?: ThrowIfIsIsProviderOptions,
) => {
  const disallowTransports = toArray(transports)

  return throwIf<H>(
    every(isProvider(...(disallowTransports as any)), options?.filter),
    {
      error: options?.error ?? defaultError,
    },
  )
}
