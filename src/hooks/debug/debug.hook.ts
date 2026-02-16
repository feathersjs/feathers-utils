import type { HookContext, NextFunction } from '@feathersjs/feathers'

/**
 * Logs the current hook context to the console for debugging purposes.
 * Displays timestamp, service path, method, type, id, data, query, result, and
 * any additional param fields you specify.
 *
 * @example
 * ```ts
 * import { debug } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { find: [debug('before find', 'user')] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/debug.html
 */
export const debug =
  <H extends HookContext = HookContext>(msg: string, ...fieldNames: string[]) =>
  async (context: H, next?: NextFunction) => {
    if (next) {
      await next()
    }

    // display timestamp
    const now = new Date()
    console.log(
      `${now.getFullYear()}-${
        now.getMonth() + 1
      }-${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
    )

    if (msg) {
      console.log(msg)
    }

    // display service, method & type of hook (before/after/error)
    console.log(
      `${context.type} service('${context.path}').${context.method}()`,
    )

    // display id for get, patch, update & remove
    if (!['find', 'create'].includes(context.method) && 'id' in context) {
      console.log('id:', context.id)
    }

    if (context.data) {
      console.log('data:', context.data)
    }

    if (context.params?.query) {
      console.log('query:', context.params.query)
    }

    if (context.result) {
      console.log('result:', context.result)
    }

    // display additional params
    const params = context.params || {}
    console.log('params props:', Object.keys(params).sort())

    fieldNames.forEach((name) => {
      console.log(`params.${name}:`, params[name])
    })

    if (context.error) {
      console.log('error', context.error)
    }
  }
