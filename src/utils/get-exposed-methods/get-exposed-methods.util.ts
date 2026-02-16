import type { Service } from '@feathersjs/feathers'
import { SERVICE } from '../../feathers-cjs-fix.js'

/**
 * Returns the list of method names that are publicly exposed by a Feathers service.
 * Reads the internal `[SERVICE].methods` property set during service registration.
 * Throws if the service does not have any exposed methods configured.
 *
 * @example
 * ```ts
 * import { getExposedMethods } from 'feathers-utils/utils'
 *
 * const methods = getExposedMethods(app.service('users'))
 * // => ['find', 'get', 'create', 'patch', 'remove']
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-exposed-methods.html
 */
export function getExposedMethods(service: Service) {
  const result = (service as any)[SERVICE].methods

  if (!result || !Array.isArray(result)) {
    throw new Error(`Service does not have exposed methods`)
  }

  return result
}
