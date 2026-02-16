import _get from 'lodash/get.js'
import _has from 'lodash/has.js'
import { BadRequest } from '@feathersjs/errors'

import { checkContext, getDataIsArray } from '../../utils/index.js'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { MaybeArray } from '../../internal.utils.js'
import { toArray } from '../../internal.utils.js'

/**
 * Validates that the specified fields exist on `context.data` and are not falsy.
 * Numeric `0` and boolean `false` are treated as valid values.
 * Throws a `BadRequest` error if any required field is missing or null.
 *
 * @example
 * ```ts
 * import { checkRequired } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: { create: [checkRequired(['email', 'password'])] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/check-required.html
 */
export function checkRequired<H extends HookContext = HookContext>(
  fieldNames: MaybeArray<string>,
) {
  const fieldNamesArray = toArray(fieldNames)
  return (context: H, next?: NextFunction) => {
    checkContext(
      context,
      ['before', 'around'],
      ['create', 'update', 'patch'],
      'checkRequired',
    )

    const { data } = getDataIsArray(context)

    for (let i = 0; i < data.length; i++) {
      const item = data[i]

      for (let j = 0; j < fieldNamesArray.length; j++) {
        const name = fieldNamesArray[j]

        if (!_has(item, name)) {
          throw new BadRequest(`Field ${name} does not exist. (required)`)
        }

        const value = _get(item, name)

        if (!value && value !== 0 && value !== false) {
          throw new BadRequest(`Field ${name} is null. (required)`)
        }
      }
    }

    if (next) return next()
  }
}
