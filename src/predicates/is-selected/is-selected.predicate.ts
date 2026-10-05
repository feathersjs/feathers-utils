import type { HookContext } from '@feathersjs/feathers'
import { selectCovers, toArray } from '../../common/index.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import type { MaybeArray } from '../../internal.utils.js'
import type { FieldKey, PredicateContextSync } from '../../types.js'
import type { ResultSingleHookContext } from '../../utility-types/hook-context.js'

/**
 * Returns a predicate that checks whether the call returns all of the given
 * fields, by its `query.$select`: there is none, or each field is in it.
 * Nested paths count as selected along with the field they lie within -
 * `$select: ['address']` selects `'address.city'`. The id field of the service
 * always counts as selected, since the adapters return it in any case. A
 * `find` with `$limit: 0` returns no items, only the `total`, so it selects no
 * field at all.
 *
 * Useful to skip work on fields the caller didn't ask for, like resolving a
 * relation whose key isn't in the result.
 *
 * @example
 * ```ts
 * import { iff, isSelected } from 'feathers-utils/predicates'
 *
 * app.service('posts').hooks({
 *   after: { find: [iff(isSelected('userId'), populateUser())] }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/predicates/is-selected.html
 */
export function isSelected<H extends HookContext = HookContext>(
  fields: MaybeArray<FieldKey<ResultSingleHookContext<NoInfer<H>>>>,
): PredicateContextSync<H> {
  const paths: string[] = toArray(fields)

  return (context: H): boolean => {
    const query = context.params?.query

    // only counts - `'0'` as it comes from a REST query
    if (
      context.method === 'find' &&
      (query?.$limit === 0 || query?.$limit === '0')
    ) {
      return false
    }

    return selectCovers(query?.$select, paths, getIdField(context.service))
  }
}
