import type { Application, HookOptions } from '@feathersjs/feathers'

/**
 * Typescript helper function to define hooks with type safety.
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
