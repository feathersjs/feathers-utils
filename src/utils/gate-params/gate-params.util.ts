import type { Params } from '@feathersjs/feathers'
import _get from 'lodash/get.js'
import _has from 'lodash/has.js'
import _set from 'lodash/set.js'
import _toPath from 'lodash/toPath.js'

/**
 * A rule for a single schema path.
 * - `true` → include the value as-is
 * - `false` → drop the path
 * - function → unified predicate/projection (see {@link GateParamsFn})
 */
export type GateParamsRule<P extends Params = Params> =
  | boolean
  | GateParamsFn<P>

/**
 * The flexible slot — serves as BOTH predicate and projection:
 * - returns `true` → include the value as-is
 * - returns `false` | `undefined` → drop the path
 * - returns any other value `r` → include `r` (projection)
 *
 * @example predicate: `(value) => value != null`
 * @example projection: `(user) => user?.id`
 */
export type GateParamsFn<P extends Params = Params> = (
  value: any,
  params: P,
) => boolean | undefined | unknown

/**
 * Declarative schema keyed by lodash **paths** in dot-notation
 * (e.g. `'query'`, `'user.id'`, `'authentication.payload.sub'`). Paths are read
 * with lodash `get`/`has`; the result is built with `set` at the same path.
 * Any custom path is allowed.
 */
export type GateParamsSchema<P extends Params = Params> = Record<
  string,
  GateParamsRule<P>
>

export type GateParamsOptions<P extends Params = Params> = {
  /**
   * Drop top-level `params` keys that the schema does not address (neither as a
   * top-level key nor as the root of a nested path). When `false` (the default)
   * those keys are kept, so only the ones you explicitly list with `false` are
   * removed; when `true` only `query` and the schema paths remain.
   *
   * Keeping unknown keys (the default) is the safe direction for cache keys: a
   * forgotten key causes at worst a harmless cache miss, never a false hit.
   *
   * @default false
   */
  dropUnknownParams?: boolean
  /**
   * Optional observer, invoked once with the top-level `params` keys the schema
   * did not address (skipped when there are none). The place to `logger.warn(...)`
   * about keys you never classified so overlooked params become loud instead of
   * silently mis-caching. Purely observational — it does not change what is kept.
   *
   * @example `(keys) => keys.forEach((k) => logger.warn('undeclared cache param', k))`
   */
  onUnknownParams?: (keys: string[], params: P) => void
}

/**
 * Selects and/or projects `params` keys according to a declarative path `schema`,
 * returning a NEW object (never mutates `params`). General-purpose — no cache
 * knowledge. Typically composed into the cache hook's `transformParams` option
 * as `(p) => gateParams(p, schema, opts)`.
 *
 * Paths are resolved with lodash `get`/`has` and written with `set`, so nested
 * values can be picked declaratively (`'user.id': true`).
 *
 * `query` is included as-is by DEFAULT (it is always relevant), unless the schema
 * addresses it explicitly — either as `query` or a nested `query.*` path.
 *
 * Keys not mentioned in the schema are KEPT by default, so forgetting a relevant
 * key can only cause a harmless cache miss, never a false hit. Pass
 * `dropUnknownParams: true` to keep only `query` and the schema paths.
 *
 * @example exclude specific params (default): everything except the listed noise
 * ```ts
 * gateParams(params, { rateLimit: false })
 * ```
 * @example include only specific params
 * ```ts
 * gateParams(params, { 'user.id': true }, { dropUnknownParams: true })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/gate-params.html
 */
export function gateParams<P extends Params = Params>(
  params: P,
  schema: GateParamsSchema<P>,
  options?: GateParamsOptions<P>,
): Params {
  const out: Record<string, any> = {}
  const claimedTop = new Set<string>()

  // schema paths drive inclusion / projection.
  for (const path of Object.keys(schema)) {
    // A path claims its top-level segment, so a parent whose child was declared
    // is never treated as unknown (e.g. `user.id` claims `user`).
    const topKey = _toPath(path)[0]
    if (topKey !== undefined) {
      claimedTop.add(topKey)
    }

    const rule = schema[path]

    // explicit exclude — no need to read params
    if (rule === false) {
      continue
    }

    // path not present — nothing to include (no injection)
    if (!_has(params, path)) {
      continue
    }

    const value = _get(params, path)

    // dynamic predicate / projection
    if (typeof rule === 'function') {
      const result = rule(value, params)
      if (result === false || result === undefined) {
        continue
      }
      _set(out, path, result === true ? value : result)
      continue
    }

    // rule === true → include as-is
    _set(out, path, value)
  }

  // `query` is always relevant, so it is included as-is by default — UNLESS the
  // schema addresses it explicitly (either as `query` or a nested `query.*` path,
  // both of which add `query` to `claimedTop`). This keeps `query` out of the
  // unknown-key handling and prevents accidentally caching across queries.
  if (!claimedTop.has('query')) {
    claimedTop.add('query')
    if (_has(params, 'query')) {
      out.query = _get(params, 'query')
    }
  }

  // Top-level keys not addressed by the schema are kept by default; `dropUnknownParams`
  // removes them instead. Either way they are collected for the `onUnknownParams` observer.
  const dropUnknown = options?.dropUnknownParams ?? false
  const source = params as Record<string, any>
  const unknownKeys: string[] = []
  for (const key of Object.keys(source)) {
    if (claimedTop.has(key)) {
      continue
    }
    unknownKeys.push(key)
    if (!dropUnknown) {
      out[key] = source[key]
    }
  }

  if (unknownKeys.length && options?.onUnknownParams) {
    options.onUnknownParams(unknownKeys, params)
  }

  return out
}
