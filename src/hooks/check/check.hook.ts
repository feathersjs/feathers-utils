import { BadRequest } from '@feathersjs/errors'
import type { FeathersError } from '@feathersjs/errors'
import type { HookContext, Id, NextFunction } from '@feathersjs/feathers'
import {
  changesTopLevel,
  isEqual,
  toArray,
  topLevelKey,
} from '../../common/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { getMergedData } from '../../utils/get-merged-data/get-merged-data.util.js'

/** An item that fails a check: its id - none on `create` - and `from` fields */
export type CheckItem<T = any> = { id: Id | undefined; data: Partial<T> }

export type CheckOptions<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
> = {
  /**
   * A name for the check, for the message and the `data` of the error.
   */
  name?: string
  /**
   * The fields `test` reads, nested paths like `'address.city'` included. A
   * `patch` that changes none of them is not checked.
   */
  from: MaybeArray<FieldKey<NoInfer<T>>>
  /**
   * Whether an item passes. Gets its `from` fields, with the values it has
   * once the call is done, and the context. May be async.
   *
   * @example
   * ```ts
   * test: ({ startDate, endDate }) => startDate <= endDate
   * ```
   */
  test: (item: Partial<NoInfer<T>>, context: H) => Promisable<boolean>
  /**
   * The error to throw instead of the `BadRequest`, e.g. to tell a form which
   * field is wrong.
   *
   * @example
   * ```ts
   * error: () =>
   *   new BadRequest('Invalid data', { errors: { endDate: 'is before the start' } })
   * ```
   */
  error?: (item: CheckItem<NoInfer<T>>, context: H) => FeathersError
  /**
   * Whether the fetch of the stored items selects only the `from` fields.
   * With `false`, it fetches the whole items - which `stash`, `trigger` and
   * the other hooks of the call reuse. See {@link getMergedData}.
   *
   * @default true
   */
  select?: boolean
}

/**
 * Checks a condition on the fields of each item, like a `CHECK` constraint:
 * `test` gets the fields with the values the item has once the call is done,
 * and the call fails with a `BadRequest` for the first item that doesn't
 * pass.
 *
 * The values are read with {@link getMergedData}, so a `patch` of only some of
 * the fields is checked against the stored others - something a validator of
 * `data` can't do. A `patch` that changes none of the fields is not checked,
 * and neither are items whose fields keep their values.
 *
 * Use it as a `before` or `around` hook, after the hooks that change `data`.
 *
 * @example
 * ```ts
 * import { check } from 'feathers-utils/hooks'
 *
 * const dateRange = check({
 *   name: 'dateRange',
 *   from: ['startDate', 'endDate'],
 *   test: ({ startDate, endDate }) => startDate <= endDate,
 * })
 *
 * app.service('events').hooks({
 *   before: { create: [dateRange], update: [dateRange], patch: [dateRange] },
 * })
 *
 * // checked against the stored `startDate`
 * await app.service('events').patch(1, { endDate: new Date(0) })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/check.html
 */
export function check<
  H extends HookContext = HookContext,
  T = DataSingleHookContext<H>,
>(options: CheckOptions<H, T>) {
  const from: string[] = toArray(options.from)
  const fromProperties = new Set(from.map(topLevelKey))

  const failed = (item: CheckItem<T>, context: H) =>
    options.error
      ? options.error(item, context)
      : new BadRequest(
          options.name ? `Check '${options.name}' failed` : 'Check failed',
          { check: options.name },
        )

  const run = async (context: H) => {
    if (
      context.method === 'patch' &&
      !changesTopLevel(context.data ?? {}, fromProperties)
    ) {
      return
    }

    const items = await getMergedData<T>(context, from as FieldKey<T>[], {
      select: options.select,
    })

    for (const { id, data, stored } of items) {
      // unchanged, it passed when it got these values
      if (stored && isEqual(data, stored)) continue

      if (!(await options.test(data, context))) {
        throw failed({ id, data }, context)
      }
    }
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'around'],
      method: ['create', 'update', 'patch'],
      label: 'check',
    })

    await run(context)
    if (next) await next()
  }

  return hook
}
