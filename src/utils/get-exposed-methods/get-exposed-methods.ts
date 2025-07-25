import type { Service } from '@feathersjs/feathers'
import { SERVICE } from '@feathersjs/feathers'

/**
 * Little helper to get methods are publicly exposed by a service.
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
