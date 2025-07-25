import { MethodNotAllowed } from '@feathersjs/errors'
import type { HookContext } from '@feathersjs/feathers'
import type { TransportName } from '../../types.js'

/**
 * Check which transport provided the service call.
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
