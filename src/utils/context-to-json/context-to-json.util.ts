import type { HookContext } from '@feathersjs/feathers'

/**
 * Converts a FeathersJS HookContext to a plain JSON object by calling `toJSON()` if available.
 * This is important when using lodash `get`/`has` on the context, since the HookContext
 * class uses getters that may not be enumerable.
 *
 * @example
 * ```ts
 * import { contextToJson } from 'feathers-utils/utils'
 *
 * const json = contextToJson(context)
 * console.log(json)
 * ```
 *
 * @see https://utils.feathersjs.com/utils/context-to-json.html
 */
export const contextToJson = (context: HookContext) => {
  if (context.toJSON) {
    return context.toJSON()
  }
  return context
}
