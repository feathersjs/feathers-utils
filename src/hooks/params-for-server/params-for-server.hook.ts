import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import { FROM_CLIENT_FOR_SERVER_DEFAULT_KEY } from './params-for-from-shared.js'

export type ParamsForServerOptions = {
  /**
   * @default '_$client'
   */
  keyToHide?: string
}

/**
 * Client-side hook that moves whitelisted `params` properties into `query._$client`
 * so they survive the client-to-server transport. The server only receives `query`
 * from params — use `paramsFromClient` on the server to restore them.
 *
 * @example
 * ```ts
 * import { paramsForServer } from 'feathers-utils/hooks'
 *
 * // Client-side
 * app.service('users').hooks({
 *   before: { all: [paramsForServer('populateParams')] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/params-for-server.html
 */
export const paramsForServer = (
  whitelist: MaybeArray<string>,
  options?: ParamsForServerOptions,
) => {
  const whitelistArr = toArray(whitelist)

  const { keyToHide = FROM_CLIENT_FOR_SERVER_DEFAULT_KEY } = options || {}

  return <H extends HookContext>(context: H, next?: NextFunction) => {
    // clone params on demand
    let clonedParams: any

    Object.keys(context.params).forEach((key) => {
      if (key === 'query') {
        return
      }

      if (whitelistArr.includes(key)) {
        if (!clonedParams) {
          clonedParams = {
            ...context.params,
            query: {
              ...context.params.query,
            },
          }
        }

        if (!clonedParams.query[keyToHide]) {
          clonedParams.query[keyToHide] = {}
        }

        clonedParams.query[keyToHide][key] = clonedParams[key]
        delete clonedParams[key]
      }
    })

    if (clonedParams) {
      context.params = clonedParams
    }

    if (next) {
      return next()
    }

    return context
  }
}
