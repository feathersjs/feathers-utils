import type { Application, HookOptions } from '@feathersjs/feathers'

/**
 * TypeScript helper that provides full type inference and autocompletion when defining
 * service hooks. It is an identity function that simply returns its input,
 * but enables your IDE to infer the correct hook context types.
 *
 * @example
 * ```ts
 * import { defineHooks } from 'feathers-utils/utils'
 *
 * export const userHooks = defineHooks({
 *   before: { create: [validateUser()] },
 *   after: { all: [sanitizeResult()] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/define-hooks.html
 */
export function defineHooks<
  A extends Application = Application,
  S = {
    find: any
    get: any
    create: any
    update: any
    patch: any
    remove: any
  },
  Options = HookOptions<A, S>,
>(hooks: Options): Options {
  return hooks
}
