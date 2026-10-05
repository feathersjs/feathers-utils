/**
 * Returns the name of the id field of a service, as the adapters name it:
 * `service.id`, then `service.options.id`, otherwise `'id'` - also for a
 * service that is `undefined`.
 *
 * @example
 * ```ts
 * import { getIdField } from 'feathers-utils/utils'
 *
 * // in a hook
 * const idField = getIdField(context.service)
 * const ids = context.result.map((item) => item[idField])
 *
 * // outside of one
 * getIdField(app.service('users')) // => '_id' for a mongodb service
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-id-field.html
 */
export function getIdField(service: object | null | undefined): string {
  return (service as any)?.id ?? (service as any)?.options?.id ?? 'id'
}
