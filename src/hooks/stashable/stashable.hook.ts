import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { checkContext } from '../../utils/index.js'

export type StashableOptions = {
  /** The property name on `context.params` to store the stash function. @default 'stashed' */
  propName?: string
  /** Custom function to fetch the pre-mutation state. Defaults to `service.get` or `service.find`. */
  stashFunc?: (context: HookContext) => Promise<any>
}

const defaultStashFunc = (context: HookContext) => {
  const isMulti = context.id == null

  const params = {
    ...context.params,
    _stashable: true,
    ...(isMulti ? { paginate: false } : {}),
  }

  return isMulti
    ? context.service.find(params)
    : context.service.get(context.id, params)
}

/**
 * Stashes the pre-mutation state of a record into `context.params`.
 * Eagerly starts the fetch but exposes a memoized function — calling it
 * multiple times only hits the database once.
 * Use in `before` hooks on `update`, `patch`, or `remove` methods.
 *
 * @example
 * ```ts
 * import { stashable } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { patch: [stashable()] }
 * })
 *
 * // In a later hook (before or after):
 * const before = await context.params.stashed()
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/stashable.html
 */
export function stashable<H extends HookContext = HookContext>(
  options?: StashableOptions,
): {
  (context: H, next: NextFunction): Promise<void>
  (context: H): H
} {
  const propName = options?.propName ?? 'stashed'
  const stashFunc = options?.stashFunc ?? defaultStashFunc

  return ((context: H, next?: NextFunction) => {
    if (context.params._stashable) {
      if (next) return next()
      return context
    }

    checkContext(
      context,
      ['before', 'around'],
      ['update', 'patch', 'remove'],
      'stashable',
    )

    const promise = stashFunc(context).catch(() => undefined)

    context.params[propName] = () => promise

    if (next) return next()
    return context
  }) as any
}
