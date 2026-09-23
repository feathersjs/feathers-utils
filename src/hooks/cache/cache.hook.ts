import type { HookContext, NextFunction, Params } from '@feathersjs/feathers'
import { stringifyParams } from '../../utils/stringify-params/stringify-params.util.js'
import { getResultIsArray } from '../../utils/get-result-is-array/get-result-is-array.util.js'
import { copy } from 'fast-copy'
import type { Promisable } from '../../internal.utils.js'
import type { PredicateFn } from '../../types.js'

type Cache = {
  get: (key: string) => Promisable<any>
  set: (key: string, value: any) => Promisable<any>
  delete: (key: string) => Promisable<any>
  clear: () => any
  keys: () => IterableIterator<string>
}

/**
 * A scope (tenant) key. Scopes are compared as strings, so `1` and `'1'` are the
 * same scope.
 */
export type CacheScopeKey = string | number | bigint

/**
 * Resolves the scope of a call — see {@link CacheOptions.scope}.
 */
export type CacheScopeFn<H extends HookContext = HookContext> = (
  context: H,
) => CacheScopeKey | CacheScopeKey[] | undefined

/**
 * Why the cache fell back to a less precise invalidation than it could have.
 *
 * - `no-ids` — the ids of the affected items could not be determined
 * - `no-scope` — {@link CacheOptions.scope} returned nothing usable
 * - `scope-error` — {@link CacheOptions.scope} threw
 */
export type CacheFallbackReason = 'no-ids' | 'no-scope' | 'scope-error'

export type CacheEvent =
  | { type: 'hit'; method: string; key: string }
  | { type: 'miss'; method: string; key: string }
  | { type: 'set'; method: string; key: string }
  | { type: 'invalidate'; method: string; key: string }
  | { type: 'clear'; method: string; reason: CacheFallbackReason }
  | { type: 'degrade'; method: string; reason: CacheFallbackReason }
  | { type: 'skip'; method: string }

export type CacheOptions<H extends HookContext = HookContext> = {
  /**
   * The cache implementation to use. It should implement the methods `get`, `set`, `delete`, `clear`, and `keys`.
   * This can be a Map, Redis client, or any other cache implementation.
   *
   * Use 'lru-cache' for an LRU cache implementation.
   */
  map: Cache
  /**
   * The id field to use for caching.
   *
   * @default service.options.id ?? 'id'
   */
  id?: string
  /**
   * Confines invalidation to a scope (a tenant, e.g. `companyId`), so a `create`
   * in one tenant no longer invalidates every cached `find` of every other
   * tenant.
   *
   * One function serves both directions — branch on `context.method`:
   *
   * - **`get`/`find`**: return the scope this call's result is *provably*
   *   confined to. Returning a scope is a promise that only mutations in that
   *   scope can change this result. Derive it from `params` only — never from
   *   `context.result`, since the key is computed before the call runs.
   * - **`create`/`update`/`patch`/`remove`**: return every scope whose cached
   *   `find` entries this mutation may affect. For `patch`/`update` that
   *   includes the item's **previous** scope whenever it can move between
   *   tenants.
   *
   * Whenever you cannot vouch for that, return `undefined` — and when in doubt,
   * do. The hook then falls back to the unscoped behaviour it has without this
   * option: the entry is stored unscoped and invalidated by every mutation, and
   * a mutation clears every cached `find`. Enabling `scope` therefore never
   * invalidates *less* than the default, and every fallback emits a `degrade`
   * event to the {@link CacheOptions.logger} so silent under-scoping stays
   * visible.
   *
   * The scope becomes the first segment of the cache key, so two tenants can
   * never be served each other's entries — even if
   * {@link CacheOptions.transformParams} drops the params the scope came from.
   *
   * Runs synchronously on every cached read and every mutation: a wrong scope
   * corrupts *invalidation*, so a round-trip has no place here. A thrown error
   * is caught, never propagated, and treated as `undefined`.
   *
   * @example
   * ```ts
   * import { cache } from 'feathers-utils/hooks'
   * import { getResultIsArray } from 'feathers-utils/utils'
   *
   * const mayChangeCompany = (data: any) =>
   *   (Array.isArray(data) ? data : [data]).some(
   *     (item) =>
   *       item &&
   *       // `$set` / `$unset` / `$inc` can move a row too
   *       ('companyId' in item ||
   *         Object.keys(item).some((key) => key.startsWith('$'))),
   *   )
   *
   * cache({
   *   map: new Map(),
   *   transformParams: (params) => ({ query: params.query }),
   *   scope: (context) => {
   *     // only scope when the query really pins the tenant down
   *     if (context.method === 'get' || context.method === 'find') {
   *       return context.params.query?.companyId
   *     }
   *
   *     // `update` replaces the row, so the company may change or be dropped
   *     if (context.method === 'update') return undefined
   *
   *     // a `patch` could move items into another company
   *     if (context.method === 'patch' && mayChangeCompany(context.data)) {
   *       return undefined
   *     }
   *
   *     return getResultIsArray(context).result.map((item) => item.companyId)
   *   },
   * })
   * ```
   */
  scope?: CacheScopeFn<H>
  /**
   * Params are stringified for the key-value cache, and there are params
   * properties you don't want in the cache key. Use this function to transform
   * the params before they are stringified.
   *
   * The {@link gateParams} util is built for exactly this: it declaratively
   * selects/projects `params` keys (keeping `query` by default) so noise like
   * `rateLimit` never ends up in the cache key.
   *
   * @example
   * ```ts
   * import { gateParams } from 'feathers-utils/utils'
   *
   * cache({
   *   map: new Map(),
   *   transformParams: (params) => gateParams(params, { rateLimit: false }),
   * })
   * ```
   */
  transformParams: (params: Params) => Params
  /**
   * Custom serialization function for converting params into a cache key string.
   * Uses {@link stringifyParams} by default, which sorts object keys and normalizes
   * query operator arrays (`$or`, `$and`, `$in`, etc.) for order-independent caching.
   *
   * The default is crash-safe: it never throws on values that leak through
   * `transformParams`. Circular references become `[Circular]`,
   * functions/`undefined`/`symbol` are dropped, `BigInt` is stringified, and
   * objects with `toJSON` (e.g. `Date`, `ObjectId`) are serialized via it.
   *
   * Override this to use a custom serialization strategy, e.g. to hash long keys
   * for an external store — the id prefix stays separate, so invalidation keeps
   * working.
   *
   * @example
   * ```ts
   * import { createHash } from 'node:crypto'
   * import { stringifyParams } from 'feathers-utils/utils'
   *
   * cache({
   *   map: redisCache,
   *   transformParams: (params) => ({ query: params.query }),
   *   serialize: (params) =>
   *     createHash('sha256').update(stringifyParams(params)).digest('base64url'),
   * })
   * ```
   */
  serialize?: (params: Params) => string
  /**
   * Optional logger callback for cache events (hit, miss, set, invalidate,
   * clear, skip). Useful for debugging and monitoring cache behavior.
   *
   * @example
   * ```ts
   * cache({
   *   map: new Map(),
   *   transformParams: (params) => ({ query: params.query }),
   *   logger: (event) => console.log(`cache ${event.type}`, event),
   * })
   * ```
   */
  logger?: (event: CacheEvent) => void
  /**
   * How to clone results on store and on hit so callers can't mutate the shared
   * cached object. The default is a `fast-copy` deep clone.
   *
   * Set to `false` to skip cloning entirely (fastest, but the caller MUST treat
   * results as immutable), or pass a custom clone function (e.g. `structuredClone`).
   *
   * @default true
   */
  clone?: boolean | (<T>(value: T) => T)
  /**
   * Only read from and write to the cache when this is truthy. Can be a boolean
   * or a (possibly async) predicate that receives the `HookContext`.
   *
   * This gates the **caching of `get`/`find` only**. Invalidation on `create`,
   * `update`, `patch` and `remove` always runs, so a call that is not allowed to
   * be served from the cache can still never leave stale entries behind.
   *
   * A gated-out call logs a `skip` event (without a key — none is computed), so
   * a cache that never fills is visible in the {@link CacheOptions.logger}
   * instead of silent.
   *
   * A predicate runs on every hook run it gates — with a `before`/`after` or
   * `around` registration that is twice per `get`/`find` call — so keep it cheap
   * and side-effect free. A sync predicate is never awaited.
   *
   * @default true
   *
   * @example
   * ```ts
   * import { cache } from 'feathers-utils/hooks'
   * import { isProvider } from 'feathers-utils/predicates'
   *
   * // only serve internal calls from the cache
   * cache({
   *   map: new Map(),
   *   transformParams: (params) => ({ query: params.query }),
   *   iff: isProvider('server'),
   * })
   * ```
   */
  iff?: boolean | PredicateFn<H>
}

/**
 * Caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`,
 * `patch`, `remove`), affected cache entries are automatically invalidated.
 * Works as a `before`, `after`, or `around` hook.
 *
 * Use the `iff` option to restrict *caching* to certain calls (e.g. internal
 * ones) — invalidation always runs, for every call. Use the `scope` option to
 * confine invalidation to a tenant, so a mutation in one tenant leaves the other
 * tenants' cached `find` results alone.
 *
 * @example
 * ```ts
 * import { cache } from 'feathers-utils/hooks'
 *
 * const myCache = new Map()
 *
 * app.service('users').hooks({
 *   around: {
 *     all: [cache({ map: myCache, transformParams: (params) => ({ query: params.query }) })]
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/cache.html
 */
export const cache = <H extends HookContext = HookContext>(
  options: CacheOptions<H>,
) => {
  const cacheMap = new ContextCacheMap(options)
  return async (context: H, next?: NextFunction): Promise<void> => {
    if (context.type === 'before') {
      return await cacheBefore(context, cacheMap)
    } else if (context.type === 'after') {
      return await cacheAfter(context, cacheMap)
    } else if (context.type === 'around' && next) {
      await cacheBefore(context, cacheMap)
      await next()
      await cacheAfter(context, cacheMap)
      return
    }
  }
}

const cacheBefore = async (
  context: HookContext,
  cacheMap: ContextCacheMap,
): Promise<void> => {
  if (context.method === 'get' || context.method === 'find') {
    // `isEnabled` only returns a promise for an async predicate, so no `iff`,
    // a boolean and a sync predicate never cost a microtask here
    const enabled = cacheMap.isEnabled(context)
    if (typeof enabled === 'boolean' ? !enabled : !(await enabled)) {
      cacheMap.skip(context)
      return
    }

    const value = await cacheMap.get(context)
    if (value) {
      context.result = value
    }
  }
}

const cacheAfter = async (
  context: HookContext,
  cacheMap: ContextCacheMap,
): Promise<void> => {
  if (context.method === 'get' || context.method === 'find') {
    const enabled = cacheMap.isEnabled(context)
    if (typeof enabled === 'boolean' ? !enabled : !(await enabled)) {
      cacheMap.skip(context)
      return
    }

    await cacheMap.set(context)
  } else {
    // invalidation is never gated by `iff`: a call that may not be served from
    // the cache must still not leave stale entries behind
    await cacheMap.clear(context)
  }
}

/** Marks a cached `find` entry — `find` has no `context.id`. */
const FIND_ID = 'null'

/** Distinguishes "the resolver threw" from "the resolver returned nothing". */
const SCOPE_ERROR = Symbol('cache.scope.error')

const isScopeKey = (value: unknown): value is CacheScopeKey => {
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'bigint'
}

class ContextCacheMap {
  map: Cache
  private delimiter = ':'
  private options: CacheOptions<any>
  private log: ((event: CacheEvent) => void) | undefined
  private serialize: (params: Params) => string
  private clone: <T>(value: T) => T
  private iff: boolean | PredicateFn<any>
  private scope: CacheScopeFn<any> | undefined

  constructor(options: CacheOptions<any>) {
    this.map = options.map
    this.options = options
    this.log = options.logger
    this.serialize = options.serialize ?? stringifyParams
    this.iff = options.iff ?? true
    this.scope = options.scope
    this.clone =
      options.clone === false
        ? (value) => value
        : typeof options.clone === 'function'
          ? options.clone
          : copy
  }

  /**
   * Whether `get`/`find` of this context may use the cache, per the `iff` option.
   *
   * Stays synchronous unless the predicate itself is async: `iff` is resolved to
   * a boolean once in the constructor, so a call without `iff` never pays for a
   * predicate at all.
   */
  isEnabled(context: HookContext): Promisable<boolean> {
    return typeof this.iff === 'function' ? this.iff(context) : this.iff
  }

  /**
   * Called when `iff` gated a `get`/`find` out of the cache. Carries no key:
   * computing one is exactly the work this path skips.
   */
  skip(context: HookContext) {
    this.log?.({ type: 'skip', method: context.method })
  }

  /**
   * Runs the `scope` resolver without ever letting it break the service call.
   * A throw is swallowed and reported as a `degrade` event.
   */
  private resolveScope(
    context: HookContext,
  ): CacheScopeKey | CacheScopeKey[] | undefined | typeof SCOPE_ERROR {
    try {
      return this.scope!(context)
    } catch {
      this.log?.({
        type: 'degrade',
        method: context.method,
        reason: 'scope-error',
      })
      return SCOPE_ERROR
    }
  }

  /**
   * The (already encoded) scope segment of a `get`/`find` key. An empty string
   * means unscoped — such an entry is invalidated by every mutation.
   */
  private readScope(context: HookContext): string {
    const resolved = this.resolveScope(context)
    if (resolved === SCOPE_ERROR) {
      return ''
    }

    // a single-element array is the same statement as the bare value — it keeps
    // a `{ $in: ['a'] }`-shaped resolver scoped
    const value =
      Array.isArray(resolved) && resolved.length === 1 ? resolved[0] : resolved

    if (!isScopeKey(value)) {
      this.log?.({
        type: 'degrade',
        method: context.method,
        reason: 'no-scope',
      })
      return ''
    }

    return encodeURIComponent(`${value}`)
  }

  /**
   * The (already encoded) scopes a mutation may affect, or `undefined` when the
   * mutation has to invalidate every cached `find` — the unscoped default.
   */
  private mutationScopes(context: HookContext): Set<string> | undefined {
    if (!this.scope) {
      return undefined
    }

    const resolved = this.resolveScope(context)
    if (resolved === SCOPE_ERROR) {
      return undefined
    }

    const values = Array.isArray(resolved) ? resolved : [resolved]

    if (!values.length || !values.every(isScopeKey)) {
      this.log?.({
        type: 'degrade',
        method: context.method,
        reason: 'no-scope',
      })
      return undefined
    }

    return new Set(values.map((value) => encodeURIComponent(`${value}`)))
  }

  private stringifyCacheKey(context: HookContext) {
    if (context.method !== 'get' && context.method !== 'find') {
      throw new Error(
        `Cache can only be used with 'get' or 'find' methods, not '${context.method}'`,
      )
    }

    const stringifiedParams = this.serialize(
      this.options.transformParams(context.params ?? {}),
    )

    // the scope segment only exists when `scope` is configured, so enabling it
    // is the only thing that ever changes the key format
    const prefix = this.scope
      ? `${this.readScope(context)}${this.delimiter}`
      : ''

    const id = encodeURIComponent(`${context.id ?? FIND_ID}`)

    return `${prefix}${id}${this.delimiter}${stringifiedParams}`
  }

  /**
   * Splits a key into its scope and id segments. Returns `undefined` for a key
   * this instance cannot read — e.g. one written before `scope` was enabled.
   * Never throws: an unreadable key is dropped rather than kept around.
   */
  private parseKey(key: string): { scope: string; id: string } | undefined {
    const first = key.indexOf(this.delimiter)
    if (first === -1) {
      return undefined
    }

    if (!this.scope) {
      return { scope: '', id: key.substring(0, first) }
    }

    const second = key.indexOf(this.delimiter, first + 1)
    if (second === -1) {
      return undefined
    }

    return {
      scope: key.substring(0, first),
      id: key.substring(first + 1, second),
    }
  }

  private getId(
    item: Record<string, any>,
    context: HookContext,
  ): string | undefined {
    const idField = context.service.options?.id || this.options.id || 'id'
    const id = item?.[idField]
    // `0` and `''` are valid ids — only nullish means "unknown"
    return id == null ? undefined : `${id}`
  }

  private invalidate(context: HookContext, key: string) {
    this.log?.({ type: 'invalidate', method: context.method, key })
    return this.map.delete(key)
  }

  private clearAll(context: HookContext, reason: CacheFallbackReason) {
    this.log?.({ type: 'clear', method: context.method, reason })
    return this.map.clear()
  }

  /**
   * Called before get() and find()
   *
   * returns a cached result for the given context if it exists.
   */
  async get(context: HookContext) {
    const key = this.stringifyCacheKey(context)
    const result = await this.map.get(key)
    if (result) {
      this.log?.({ type: 'hit', method: context.method, key })
      return this.clone(result) // clone to avoid mutation of the cached result
    }
    this.log?.({ type: 'miss', method: context.method, key })
  }

  /**
   * Called after get() and find()
   *
   * Caches the result for the given context.
   */
  async set(context: HookContext) {
    const key = this.stringifyCacheKey(context)
    this.log?.({ type: 'set', method: context.method, key })
    // clone to avoid later mutation of the cached result
    return this.map.set(key, this.clone(context.result))
  }

  // Called after create(), update(), patch(), and remove()
  async clear<H extends HookContext>(context: H): Promise<H> {
    const { result: results } = getResultIsArray(context)

    // Nothing to reason about at all — wipe rather than guess.
    if (!results.length) {
      await this.clearAll(context, 'no-ids')
      return context
    }

    // `create` never affects a cached `get`: an entry for an id that already
    // existed cannot be changed by inserting a new row — so it needs no ids at
    // all. Every other method must know *all* affected ids, since a partially
    // known set would leave the cached `get` entries of the unknown ones
    // silently stale (e.g. when `$select` stripped the id field from the
    // result).
    const touchesGetEntries = context.method !== 'create'

    // O(1) membership instead of an O(results) scan per cached key.
    const idSet = new Set<string>()

    if (touchesGetEntries) {
      for (const item of results) {
        const id = this.getId(item, context)

        if (id === undefined) {
          await this.clearAll(context, 'no-ids')
          return context
        }

        idSet.add(encodeURIComponent(id))
      }
    }

    // `undefined` means "invalidate every cached find", which is what this hook
    // does without a `scope` option
    const scopes = this.mutationScopes(context)

    const promises: any[] = []

    for (const key of this.map.keys()) {
      const parsed = this.parseKey(key)

      if (!parsed) {
        // A key this instance cannot read — e.g. written before `scope` was
        // enabled. Never keep an entry we cannot reason about.
        promises.push(this.invalidate(context, key))
        continue
      }

      const { scope, id } = parsed

      if (id === FIND_ID) {
        // A cached `find`: any create/patch/update/remove within its scope could
        // affect its results. An unscoped entry (empty scope segment) makes no
        // promise about which scope it belongs to, so every mutation clears it.
        if (!scopes || !scope || scopes.has(scope)) {
          promises.push(this.invalidate(context, key))
        }
        continue
      }

      // A cached `get`, invalidated by id alone — already precise, and the
      // item's scope does not have to agree with the key's.
      if (touchesGetEntries && idSet.has(id)) {
        promises.push(this.invalidate(context, key))
      }
    }

    await Promise.all(promises)

    return context
  }
}
