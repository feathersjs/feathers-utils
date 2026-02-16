import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext } from '@feathersjs/feathers'
import type { TransportName } from '../../types.js'

/**
 * Returns a predicate that checks the transport provider of the service call.
 * Matches against `'rest'`, `'socketio'`, `'external'` (any external provider),
 * or `'server'` (internal call without a provider).
 *
 * @example
 * ```ts
 * import { iff, isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: { all: [iff(isProvider('external'), authenticate('jwt'))] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/is-provider.html
 */
export function isProvider<H extends HookContext = HookContext>(
  ...providers: TransportName[]
) {
  if (!providers.length) {
    throw new MethodNotAllowed('Calling isProvider predicate incorrectly.')
  }

  return (context: H): boolean => {
    const hookProvider = context.params.provider

    return providers.some(
      (provider) =>
        provider === hookProvider ||
        (provider === 'server' && !hookProvider) ||
        (provider === 'external' && !!hookProvider),
    )
  }
}
