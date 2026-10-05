import {
  feathers,
  type Application,
  type HookContext,
  type Id,
  type NextFunction,
  type Params,
} from '@feathersjs/feathers'
import type { HookType, MethodName } from '../../types.js'
import { methodNames } from '../../types.js'

export type RunHookOptions = {
  /**
   * The hook type to register the hook as. An `error` hook only runs when the
   * call fails, so it needs `error` as well.
   */
  type: HookType
  /**
   * The method to call, a custom one included.
   */
  method: MethodName
  /**
   * The `id` of the call, for `get`, `update`, `patch` and `remove` - `null`
   * for the multi variants.
   */
  id?: Id | null
  /**
   * The `data` of the call, for `create`, `update`, `patch` and custom
   * methods.
   */
  data?: unknown
  /**
   * The `params` of the call. They are passed on as they are, so a hook that
   * writes into them writes into yours - which is what
   * {@link expectNoSideEffects} checks. Any key goes, `user` and the like
   * included.
   *
   * @default {}
   */
  params?: Params & Record<string, any>
  /**
   * What the stub service returns - the `result` that `after` hooks and an
   * `around` hook after `next()` get to see.
   */
  result?: unknown
  /**
   * What the stub service throws instead of returning `result`.
   */
  error?: unknown
  /**
   * The service to run the hook on instead of the stub, e.g. a
   * `MemoryService` with the `multi`, `paginate` or `id` options the hook
   * reads. It must not be registered on an app yet, and `result` and `error`
   * can't be passed along, since they belong to the stub.
   *
   * @example
   * ```ts
   * runHook(checkMulti(), {
   *   type: 'before',
   *   method: 'create',
   *   data: [{ name: 'a' }, { name: 'b' }],
   *   service: new MemoryService({ multi: false }),
   * })
   * ```
   */
  service?: object
  /**
   * The app to register the service on instead of a new one - for a hook
   * that calls other services through `context.app`. The service is removed
   * again once the call is done, so `path` must be free.
   */
  app?: Application
  /**
   * The path to register the service at.
   *
   * @default 'service'
   */
  path?: string
}

/**
 * Runs a single hook the way Feathers runs it, without setting up a service
 * for it, and returns the context once the call is done. The hook is
 * registered on a stub service of a new app, which returns `result` (or
 * throws `error`), and the method is called with `id`, `data` and `params`.
 * If the call fails, `runHook` rejects with its error.
 *
 * The context is a real Feathers hook context: `app`, `service`, `path` and
 * `method` are set, a `before` hook that sets `context.result` skips the
 * stub, and an `around` hook gets a `next` that calls it.
 *
 * @example
 * ```ts
 * import { runHook } from 'feathers-utils/testing'
 * import { setField } from 'feathers-utils/hooks'
 *
 * const context = await runHook(
 *   setField({ from: 'params.user.id', as: 'params.query.userId' }),
 *   { type: 'before', method: 'find', params: { user: { id: 1 } } },
 * )
 *
 * expect(context.params.query).toEqual({ userId: 1 })
 * ```
 *
 * @example
 * ```ts
 * // an after hook, with the result the stub returns
 * const context = await runHook(
 *   transformResult((user) => omit(user, 'password')),
 *   { type: 'after', method: 'get', id: 1, result: { id: 1, password: 'x' } },
 * )
 *
 * expect(context.result).toEqual({ id: 1 })
 * ```
 *
 * @see https://utils.feathersjs.com/testing/run-hook.html
 */
export async function runHook<H extends HookContext = HookContext>(
  hook: (context: H, next: NextFunction) => unknown,
  options: RunHookOptions,
): Promise<H> {
  const { type, method } = options
  // as feathers keys its services
  const path = (options.path ?? 'service').replace(/^\/+|\/+$/g, '')

  if (options.service && ('result' in options || 'error' in options)) {
    throw new Error(
      'runHook: `result` and `error` are what the stub service returns or throws - leave them out when passing `service`',
    )
  }
  if (type === 'error' && !options.service && !('error' in options)) {
    throw new Error(
      'runHook: an error hook only runs when the call fails - pass the `error` the stub service throws',
    )
  }

  const app = options.app ?? feathers()
  if (app.services[path]) {
    throw new Error(
      `runHook: the app already has a service at '${path}' - pass another \`path\``,
    )
  }

  const service = options.service ?? stubService(options)
  app.use(
    path,
    service as any,
    methodNames.includes(method as any) ? {} : { methods: [method] },
  )

  let context: H | undefined
  // registered first, so it is the outermost hook and sees the whole call
  const capture = async (ctx: H, next: NextFunction) => {
    context = ctx
    await next()
  }

  app.service(path).hooks({
    around: { [method]: type === 'around' ? [capture, hook] : [capture] },
    ...(type !== 'around' && { [type]: { [method]: [hook] } }),
  })

  try {
    await (app.service(path) as any)[method](...argumentsOf(options))
  } finally {
    if (options.app) await app.unuse(path)
  }

  return context!
}

const stubService = (options: RunHookOptions) => ({
  async [options.method]() {
    if ('error' in options) throw options.error
    return options.result
  },
})

const argumentsOf = ({ method, id, data, params = {} }: RunHookOptions) => {
  switch (method) {
    case 'find':
      return [params]
    case 'get':
    case 'remove':
      return [id, params]
    case 'update':
    case 'patch':
      return [id, data, params]
    default:
      // `create` and custom methods
      return [data, params]
  }
}
