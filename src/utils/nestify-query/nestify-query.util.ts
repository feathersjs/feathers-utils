import type { Query } from '@feathersjs/feathers'
import { branchOperators, isPlainObject } from '../../common/index.js'
import {
  assignPath,
  dotifySortKeys,
  mergeAndBranches,
  nest,
  setNested,
} from '../dotify-query/dotify-keys.js'

export type NestifyQueryPredicateOptions = {
  /** the current — possibly dotted — key, e.g. `'owner.name'` */
  key: string
  /** the full dotted path including the key, e.g. `'company.owner.name'` */
  path: string
  /** the value at that key */
  value: any
}

export type NestifyQueryOptions = {
  /**
   * Per-key override. Return `true` to split the key into nested objects,
   * `false` to keep it as-is, or `undefined` to fall through to
   * `exclude`/`include` and then the default heuristic.
   *
   * Only called for keys that actually contain a `.`, and it takes precedence
   * over `exclude`/`include`.
   */
  split?: (options: NestifyQueryPredicateOptions) => boolean | undefined | void
  /** Dotted paths that are never split. Matches the full `path`. */
  exclude?: string[]
  /** If given, only these dotted paths are split. Matches the full `path`. */
  include?: string[]
}

type State = { changed: boolean }

const shouldSplit = (
  options: NestifyQueryOptions,
  ctx: NestifyQueryPredicateOptions,
): boolean => {
  const explicit = options.split?.(ctx)
  if (typeof explicit === 'boolean') {
    return explicit
  }

  if (options.exclude?.includes(ctx.path)) {
    return false
  }

  if (options.include && !options.include.includes(ctx.path)) {
    return false
  }

  // defensive: a path containing an operator segment is never split
  return !ctx.key.split('.').some((segment) => segment.startsWith('$'))
}

const nestifyBranches = (
  branches: any[],
  options: NestifyQueryOptions,
  prefix: string,
  state: State,
): any[] =>
  branches.map((branch) =>
    isPlainObject(branch)
      ? nestifyBody(branch, options, prefix, state)
      : branch,
  )

const nestifyBody = (
  query: Record<string, any>,
  options: NestifyQueryOptions,
  prefix: string,
  state: State,
): Record<string, any> => {
  const result: Record<string, any> = {}
  // conditions that collided with an already-assigned key; merged into `$and`
  // once every key is processed, so key order cannot clobber an existing `$and`
  const conflicts: Record<string, any>[] = []

  for (const key of Object.keys(query)) {
    const value = query[key]

    if (branchOperators.has(key) && Array.isArray(value)) {
      result[key] = nestifyBranches(value, options, prefix, state)
      continue
    }

    if (key === '$not') {
      result[key] = Array.isArray(value)
        ? nestifyBranches(value, options, prefix, state)
        : isPlainObject(value)
          ? nestifyBody(value, options, prefix, state)
          : value
      continue
    }

    // `$sort` stays in dot notation — that is the only form adapters understand
    if (key === '$sort' && isPlainObject(value)) {
      const sort = dotifySortKeys(value)
      if (sort !== value) {
        state.changed = true
      }
      result[key] = sort
      continue
    }

    // `$select`, `$limit`, `$skip` and any custom operator pass through
    if (key.startsWith('$')) {
      result[key] = value
      continue
    }

    const path = prefix ? `${prefix}.${key}` : key
    const segments = key.split('.')
    const split =
      segments.length > 1 && shouldSplit(options, { key, path, value })

    // a plain object value may hold dotted keys of its own; an object of nothing
    // but operators is a leaf
    let nestedValue = value
    let innerAnd: Record<string, any>[] = []
    if (
      isPlainObject(value) &&
      Object.keys(value).some((subKey) => !subKey.startsWith('$'))
    ) {
      const inner = nestifyBody(value, options, path, state)

      // a `$and` produced inside the value belongs to this level — a logical
      // operator cannot sit inside a property
      if (Array.isArray(inner.$and)) {
        const { $and, ...rest } = inner
        innerAnd = $and
        nestedValue = rest
      } else {
        nestedValue = inner
      }
    }

    let didSplit = false
    let conflict: Record<string, any> | undefined

    if (split) {
      // `setNested` may report back that it did not split after all, because the
      // path was blocked and the dotted key was kept instead
      const outcome = setNested(result, segments, nestedValue)
      didSplit = outcome.split
      conflict = outcome.conflict

      if (didSplit) {
        state.changed = true
      }
    } else {
      conflict = assignPath(result, key, nestedValue)
    }

    if (conflict) {
      conflicts.push(conflict)
    }

    // re-key the hoisted branches to wherever the value actually ended up
    for (const branch of innerAnd) {
      conflicts.push(didSplit ? nest(segments, branch) : { [key]: branch })
    }
  }

  if (conflicts.length > 0) {
    state.changed = true
    mergeAndBranches(result, conflicts)
  }

  return result
}

/**
 * Converts the dot-notation properties of a Feathers query into nested objects —
 * `{ 'user.name': 'x' }` becomes `{ user: { name: 'x' } }`. This is the inverse
 * of {@link dotifyQuery}.
 *
 * The conversion is query-aware rather than a generic object unflatten:
 * - `$or`/`$and`/`$nor`/`$not` branches are converted individually
 * - `$sort` keys are kept in dot notation (nested ones are flattened), because
 *   that is the only form the Feathers adapters understand
 * - `$select`, `$limit`, `$skip` and custom operators pass through untouched —
 *   `$select` holds paths as *values*, not as keys
 * - a path containing a `$`-prefixed segment is never split
 *
 * Use `split`, `exclude` or `include` for keys whose dots are meaningful data.
 * The query is not mutated and is returned unchanged (same reference) when there
 * was nothing to convert.
 *
 * Nothing is ever dropped when two keys collide. Deep-equal values collapse into
 * one, objects with disjoint keys merge, and a genuine contradiction is wrapped
 * in `$and`, since the colliding keys were an implicit AND to begin with — this
 * matches {@link addToQuery}. A key whose path is blocked by a non-object value
 * needs no `$and` at all: it simply stays in dot notation, which is already a
 * valid condition.
 *
 * **Caveat:** this direction is best effort and not semantics-preserving on
 * MongoDB, where `{ user: { name: 'x' } }` means *document equality* while
 * `{ 'user.name': 'x' }` means a *subfield match*. `dotifyQuery` is the reliable
 * direction; reach for `nestifyQuery` when a consumer genuinely needs the nested
 * shape.
 *
 * @example
 * ```ts
 * import { nestifyQuery } from 'feathers-utils/utils'
 *
 * nestifyQuery({ 'user.name': { $ne: 'x' } })
 * // => { user: { name: { $ne: 'x' } } }
 *
 * nestifyQuery({ 'user.name': 'a', 'user.age': { $gt: 18 } })
 * // => { user: { name: 'a', age: { $gt: 18 } } }
 *
 * nestifyQuery({ $sort: { 'user.name': 1 } })
 * // => { $sort: { 'user.name': 1 } } (unchanged on purpose)
 * ```
 *
 * @example
 * ```ts
 * // the dots in this key are data, not a path
 * nestifyQuery({ 'x.y': 1, 'a.b': 2 }, { exclude: ['x.y'] })
 * // => { 'x.y': 1, a: { b: 2 } }
 * ```
 *
 * @example
 * ```ts
 * // sibling paths merge into one object
 * nestifyQuery({ 'user.name': 'a', user: { age: 1 } })
 * // => { user: { name: 'a', age: 1 } }
 *
 * // `user` is not an object here, so the dotted key stays as it is
 * nestifyQuery({ user: 5, 'user.name': 'a' })
 * // => { user: 5, 'user.name': 'a' } (unchanged)
 *
 * // a real contradiction still needs an `$and`
 * nestifyQuery({ 'user.name': 'a', user: { name: 'b' } })
 * // => { user: { name: 'a' }, $and: [{ user: { name: 'b' } }] }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/nestify-query.html
 */
export const nestifyQuery = <Q extends Query>(
  query: Q,
  options: NestifyQueryOptions = {},
): Q => {
  if (!isPlainObject(query)) {
    return query
  }

  const state: State = { changed: false }
  const result = nestifyBody(query, options, '', state)

  return (state.changed ? result : query) as Q
}
