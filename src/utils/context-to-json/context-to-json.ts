import type { HookContext } from '@feathersjs/feathers'

/**
 * Converts a FeathersJS HookContext to JSON.
 * If the context has a `toJSON` method, it will call that method.
 * Otherwise, it will return the context as is.
 *
 * This is useful for serializing the context for logging or debugging purposes.
 * E.g. when you use 'has'/'get' from lodash to access properties of the context.
 *
 * @see https://utils.feathersjs.com/utils/context-to-json.html
 */
export const contextToJson = (context: HookContext) => {
  if (context.toJSON) {
    return context.toJSON()
  }
  return context
}
