import { BadRequest } from '@feathersjs/errors'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import {
  extractQueryFilters,
  isPathWithin,
  isPlainObject,
  toArray,
} from '../../common/index.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { dotifyQuery } from '../../utils/dotify-query/dotify-query.util.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'

type Rule = true | readonly string[]

export type RestrictQueryOptions = {
  /**
   * The fields external callers may filter, sort and select by. `true` allows
   * every operator on a field, a list equality and the listed operators. A
   * field within an allowed one is allowed as well - `address` allows
   * `address.city` - and the most specific field decides.
   *
   * @example
   * ```ts
   * fields: { name: true, createdAt: ['$gt', '$lt'], address: true }
   * ```
   */
  fields: Record<string, Rule>
}

/**
 * Restricts the fields external callers may query by - filter, sort and
 * select - and the operators they may use on each, and throws a `BadRequest`
 * for anything else. Without it, a client can filter or sort by any field,
 * e.g. `{ password: { $regex: '^a' } }`, and learn about fields the result
 * never shows.
 *
 * Checks the query including `$and`, `$or` and `$nor`, plus `$sort` and
 * `$select`. Nested queries count by their path: `{ address: { city } }` is
 * a query by `address.city`. The id field of the service is always allowed.
 * Internal calls, without a `provider`, are not restricted.
 *
 * @example
 * ```ts
 * import { restrictQuery } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({
 *   before: {
 *     all: [restrictQuery({ fields: { name: true, createdAt: ['$gt', '$lt'] } })],
 *   },
 * })
 *
 * // BadRequest: 'password' is not allowed in the query
 * await app.service('users').find({ provider: 'rest', query: { password: 'x' } })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/restrict-query.html
 */
export function restrictQuery<H extends HookContext = HookContext>(
  options: RestrictQueryOptions,
) {
  const allowed = Object.entries(options.fields)

  /** the rule of the most specific allowed field the path lies within */
  const ruleOf = (path: string, idField: string): Rule | undefined => {
    if (path === idField) return true

    let rule: Rule | undefined
    let length = -1
    for (const [field, fieldRule] of allowed) {
      if (field.length > length && isPathWithin(path, field)) {
        rule = fieldRule
        length = field.length
      }
    }
    return rule
  }

  const assertAllowed = (path: string, idField: string): Rule => {
    const rule = ruleOf(path, idField)
    if (rule === undefined) {
      throw new BadRequest(`'${path}' is not allowed in the query`, {
        field: path,
      })
    }
    return rule
  }

  const checkBody = (query: Record<string, any>, idField: string) => {
    for (const key in query) {
      const value = query[key]

      if (key === '$or' || key === '$and' || key === '$nor') {
        if (Array.isArray(value)) {
          for (const branch of value) checkBody(branch, idField)
        }
        continue
      }
      // custom filters are up to the adapter, which rejects unknown ones
      if (key.startsWith('$')) continue

      const rule = assertAllowed(key, idField)
      if (rule === true || !isPlainObject(value)) continue

      for (const operator in value) {
        if (operator.startsWith('$') && !rule.includes(operator)) {
          throw new BadRequest(
            `The operator '${operator}' is not allowed for '${key}'`,
            { field: key, operator },
          )
        }
      }
    }
  }

  const check = (context: H) => {
    if (!context.params.provider || !context.params.query) return

    const idField = getIdField(context.service)
    // nested queries as paths, `$sort` keys included
    const { query, $sort, $select } = extractQueryFilters(
      dotifyQuery(context.params.query),
    )

    checkBody(query, idField)
    if ($sort) {
      for (const path in $sort) assertAllowed(path, idField)
    }
    if ($select) {
      for (const path of toArray($select) as string[]) {
        assertAllowed(path, idField)
      }
    }
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'around'],
      label: 'restrictQuery',
    })

    check(context)
    if (next) await next()
  }

  return hook
}
