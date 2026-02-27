import _has from 'lodash/has.js'
import _omit from 'lodash/omit.js'
import type { FeathersError } from '@feathersjs/errors'
import { BadRequest } from '@feathersjs/errors'
import { transformData } from '../transform-data/transform-data.hook.js'
import type { KeyOfOrDotNotation, MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'
import type { HookContext } from '@feathersjs/feathers'
import type { DataSingleHookContext } from '../../utility-types/hook-context.js'

export type PreventChangesOptions<D, Keys extends KeyOfOrDotNotation<D>> = {
  /**
   * Customize the error that is thrown if the service tries to patch a field that is not allowed.
   *
   * If not provided, throws a `BadRequest` error with a message indicating the field that is not allowed.
   */
  error?: boolean | ((item: D, name: Keys) => FeathersError)
}

/**
 * Prevents `patch` calls from modifying certain fields. By default, the protected
 * fields are silently removed from `context.data`. When `error` is set, a `BadRequest`
 * is thrown if any protected field is present.
 *
 * Supports dot.notation for nested fields.
 *
 * @example
 * ```ts
 * import { preventChanges } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { patch: [preventChanges(['email', 'role'], { error: true })] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/prevent-changes.html
 */
export const preventChanges = <
  H extends HookContext = HookContext,
  D extends DataSingleHookContext<H> = DataSingleHookContext<H>,
  Keys extends KeyOfOrDotNotation<D> = KeyOfOrDotNotation<D>,
>(
  fieldNames: MaybeArray<Keys>,
  options?: PreventChangesOptions<D, Keys>,
) => {
  const fieldNamesArr = toArray(fieldNames)

  return transformData<H, D>((item) => {
    if (options?.error) {
      for (let i = 0; i < fieldNamesArr.length; i++) {
        const name = fieldNamesArr[i]

        if (_has(item, name)) {
          const error =
            typeof options.error === 'function'
              ? options.error(item, name)
              : new BadRequest(
                  `Field ${String(name)} may not be patched. (preventChanges)`,
                )

          throw error
        }
      }
    } else {
      item = _omit(item, fieldNamesArr)
    }

    return item
  })
}
