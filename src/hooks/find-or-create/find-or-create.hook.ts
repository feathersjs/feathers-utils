import _get from 'lodash/get.js'
import _set from 'lodash/set.js'
import { BadRequest } from '@feathersjs/errors'
import type { HookContext, NextFunction, Params } from '@feathersjs/feathers'
import { checkContext, getDataIsArray } from '../../utils/index.js'
import {
  toArray,
  type KeyOfOrDotNotation,
  type MaybeArray,
  type NeverFallback,
} from '../../internal.utils.js'
import type {
  InferCreateDataSingle,
  InferFindParams,
} from '../../utility-types/infer-service-methods.js'

/**
 * The valid `uniqueBy` paths for a service's create data. Falls back to a plain
 * `string` when the create data type can't be inferred (e.g. an untyped app), so
 * the hook stays usable without a strongly-typed `feathers()` instance.
 */
type UniqueByPath<S> = NeverFallback<
  KeyOfOrDotNotation<InferCreateDataSingle<S>>,
  string
>

export interface FindOrCreateOptions<
  H extends HookContext = HookContext,
  Services extends H['app']['services'] = H['app']['services'],
  S extends keyof Services = keyof Services,
> {
  /** The service to search before creating. Must be a service registered on the app. */
  service: S
  /**
   * One or more property paths (dot-notation supported) read from `context.data` to build
   * the lookup query — the upsert "conflict target". A path whose value is `undefined` in
   * the data is skipped.
   */
  uniqueBy: MaybeArray<UniqueByPath<Services[S]>>
  /**
   * Optional function returning extra `find` params. `query` is merged with (and overridden
   * by) the `uniqueBy` values; `paginate` is always forced to `false`.
   */
  params?: (context: H) => InferFindParams<Services[S]>
  /**
   * What to do when more than one record matches the `uniqueBy` query.
   * - `'create'` (default): proceed to create a new record.
   * - `'throw'`: throw a `BadRequest`.
   * - `'first'`: short-circuit with the first match.
   *
   * @default 'create'
   */
  onMultiple?: 'create' | 'throw' | 'first'
}

/**
 * A `before:create` (or `around:create`) hook that looks for an existing record before creating one.
 *
 * It builds a query from the `uniqueBy` paths read out of `context.data`, runs
 * `find({ paginate: false })` on the target service, and if **exactly one** record matches, sets
 * `context.result` to that record — short-circuiting the create. With zero matches (or array data)
 * the create proceeds; with multiple matches the `onMultiple` option decides.
 *
 * @example
 * ```ts
 * import { findOrCreate } from 'feathers-utils/hooks'
 *
 * app.service('tags').hooks({
 *   before: {
 *     create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/find-or-create.html
 */
export function findOrCreate<H extends HookContext = HookContext>(
  options: FindOrCreateOptions<H>,
) {
  return async (context: H, next?: NextFunction): Promise<void> => {
    checkContext(context, {
      type: ['before', 'around'],
      method: ['create'],
      label: 'findOrCreate',
    })

    const { service, uniqueBy, onMultiple = 'create' } = options
    const { data, isArray } = getDataIsArray(context)

    // find-or-create is single-record only; arrays/empty fall through to the normal create.
    if (isArray || data.length !== 1) {
      if (next) await next()
      return
    }

    const [item] = data as Record<string, unknown>[]

    const baseParams: Params = options.params ? options.params(context) : {}
    const query: Record<string, unknown> = { ...(baseParams.query ?? {}) }
    for (const path of toArray(uniqueBy as MaybeArray<string>)) {
      const val = _get(item, path)
      if (val === undefined) continue
      _set(query, path, val)
    }

    const found = (await context.app.service(service as string).find({
      ...baseParams,
      query,
      paginate: false as const,
    })) as unknown[]
    const items = Array.isArray(found) ? found : []

    if (items.length === 1 || (items.length > 1 && onMultiple === 'first')) {
      // Short-circuit: skips the real create for `before` (Feathers skips the method) and for
      // `around` (we never call next()).
      context.result = items[0] as H['result']
      return
    }

    if (items.length > 1 && onMultiple === 'throw') {
      throw new BadRequest(
        `findOrCreate: found ${items.length} records matching the unique query on '${String(service)}'`,
      )
    }

    // No single match: proceed to create.
    if (next) await next()
  }
}
