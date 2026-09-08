import type { Query } from '@feathersjs/feathers'
import { branchOperators, isPlainObject } from '../../common/index.js'
import { assignPath, dotifySortKeys, mergeAndBranches } from './dotify-keys.js'

export type DotifyQueryPredicateOptions = {
  /** the current key, e.g. `'owner'` */
  key: string
  /** the full dotted path including the key, e.g. `'company.owner'` */
  path: string
  /** the value at that key */
  value: any
}

export type DotifyQueryOptions = {
  /**
   * Per-key override. Return `true` to descend into the value, `false` to treat
   * it as a leaf value, or `undefined` to fall through to `exclude`/`include`
   * and then the default heuristic.
   *
   * Only called for values that could be descended at all (non-empty plain
   * objects), and it takes precedence over `exclude`/`include`.
   */
  descend?: (options: DotifyQueryPredicateOptions) => boolean | undefined | void
  /** Dotted paths that are never descended into. Matches the full `path`. */
  exclude?: string[]
  /**
   * If given, only these dotted paths are descended into. Matches the full
   * `path`.
   */
  include?: string[]
}

type State = { changed: boolean }

const shouldDescend = (
  options: DotifyQueryOptions,
  ctx: DotifyQueryPredicateOptions,
): boolean => {
  const { value } = ctx

  // only non-empty plain objects are candidates — `Date`, `RegExp`, `ObjectId`,
  // class instances, arrays and primitives are always values
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    return false
  }

  const explicit = options.descend?.(ctx)
  if (typeof explicit === 'boolean') {
    return explicit
  }

  if (options.exclude?.includes(ctx.path)) {
    return false
  }

  if (options.include && !options.include.includes(ctx.path)) {
    return false
  }

  // an object of nothing but `$`-operators is a leaf
  return Object.keys(value).some((key) => !key.startsWith('$'))
}

const dotifyBranches = (
  branches: any[],
  options: DotifyQueryOptions,
  prefix: string,
  state: State,
): any[] =>
  branches.map((branch) =>
    isPlainObject(branch) ? dotifyBody(branch, options, prefix, state) : branch,
  )

const dotifyBody = (
  query: Record<string, any>,
  options: DotifyQueryOptions,
  prefix: string,
  state: State,
): Record<string, any> => {
  const result: Record<string, any> = {}
  // conditions that collided with an already-assigned path; merged into `$and`
  // once every key is processed, so key order cannot clobber an existing `$and`
  const conflicts: Record<string, any>[] = []

  for (const key of Object.keys(query)) {
    const value = query[key]

    if (branchOperators.has(key) && Array.isArray(value)) {
      result[key] = dotifyBranches(value, options, prefix, state)
      continue
    }

    if (key === '$not') {
      result[key] = Array.isArray(value)
        ? dotifyBranches(value, options, prefix, state)
        : isPlainObject(value)
          ? dotifyBody(value, options, prefix, state)
          : value
      continue
    }

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

    if (!shouldDescend(options, { key, path, value })) {
      const conflict = assignPath(result, path, value)
      if (conflict) {
        conflicts.push(conflict)
      }
      continue
    }

    state.changed = true

    // operators stay on the current path, plain sub-keys are descended
    const operators: Record<string, any> = {}
    const nested: Record<string, any> = {}
    for (const subKey of Object.keys(value)) {
      if (subKey.startsWith('$')) {
        operators[subKey] = value[subKey]
      } else {
        nested[subKey] = value[subKey]
      }
    }

    if (Object.keys(operators).length > 0) {
      const conflict = assignPath(result, path, operators)
      if (conflict) {
        conflicts.push(conflict)
      }
    }

    const dotted = dotifyBody(nested, options, path, state)
    for (const dottedKey of Object.keys(dotted)) {
      // the sub-object's own conflicts belong to this level's implicit `$and`,
      // because its keys just became keys of this level
      if (dottedKey === '$and') {
        conflicts.push(...dotted.$and)
        continue
      }

      const conflict = assignPath(result, dottedKey, dotted[dottedKey])
      if (conflict) {
        conflicts.push(conflict)
      }
    }
  }

  if (conflicts.length > 0) {
    state.changed = true
    mergeAndBranches(result, conflicts)
  }

  return result
}

/**
 * Converts the nested properties of a Feathers query into dot notation —
 * `{ user: { name: 'x' } }` becomes `{ 'user.name': 'x' }`. This is the form
 * every Feathers adapter understands, so it is the direction you normally want.
 *
 * The conversion is query-aware rather than a generic object flatten:
 * - operators (`$ne`, `$in`, ...) never become path segments
 * - `$or`/`$and`/`$nor`/`$not` branches are converted individually
 * - `$sort` keys are flattened, its directions are kept
 * - `$select`, `$limit`, `$skip` and custom operators pass through untouched
 *
 * A value is only treated as a path when it is a non-empty plain object with at
 * least one non-`$` key. `Date`, `RegExp`, bson `ObjectId`, class instances,
 * arrays, primitives and `{}` are always values. An object that mixes operators
 * and plain keys keeps its operators on the current path:
 * `{ user: { $ne: null, name: 'x' } }` becomes
 * `{ user: { $ne: null }, 'user.name': 'x' }`.
 *
 * Use `descend`, `exclude` or `include` for properties that legitimately hold an
 * object value. The query is not mutated and is returned unchanged (same
 * reference) when there was nothing to convert.
 *
 * Nothing is ever dropped when two paths collide. Deep-equal values collapse
 * into one, operator objects with disjoint keys merge, and a genuine
 * contradiction is wrapped in `$and` — the colliding keys were an implicit AND
 * to begin with. This matches {@link addToQuery}.
 *
 * @example
 * ```ts
 * import { dotifyQuery } from 'feathers-utils/utils'
 *
 * dotifyQuery({ user: { name: { $ne: 'x' } } })
 * // => { 'user.name': { $ne: 'x' } }
 *
 * dotifyQuery({ $or: [{ user: { name: 'a' } }] })
 * // => { $or: [{ 'user.name': 'a' }] }
 *
 * dotifyQuery({ $sort: { user: { name: 1 } } })
 * // => { $sort: { 'user.name': 1 } }
 * ```
 *
 * @example
 * ```ts
 * // contradicting conditions for the same path are kept as an `$and`
 * dotifyQuery({ 'user.name': 'a', user: { name: 'b' } })
 * // => { 'user.name': 'a', $and: [{ 'user.name': 'b' }] }
 *
 * // disjoint operators merge, deep-equal values collapse
 * dotifyQuery({ 'user.age': { $gt: 18 }, user: { age: { $lt: 30 } } })
 * // => { 'user.age': { $gt: 18, $lt: 30 } }
 * ```
 *
 * @example
 * ```ts
 * // `meta` holds an object that should be matched by equality
 * dotifyQuery({ meta: { a: 1 } }, { exclude: ['meta'] })
 * // => { meta: { a: 1 } }
 *
 * // depth-agnostic: never descend into a key named `meta`
 * dotifyQuery(query, {
 *   descend: ({ key }) => (key === 'meta' ? false : undefined),
 * })
 * ```
 *
 * @example
 * ```ts
 * // normalize incoming queries for the whole service
 * import { transformQuery } from 'feathers-utils/hooks'
 *
 * app.service('users').hooks({ before: { find: [transformQuery(dotifyQuery)] } })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/dotify-query.html
 */
export const dotifyQuery = <Q extends Query>(
  query: Q,
  options: DotifyQueryOptions = {},
): Q => {
  if (!isPlainObject(query)) {
    return query
  }

  const state: State = { changed: false }
  const result = dotifyBody(query, options, '', state)

  return (state.changed ? result : query) as Q
}
