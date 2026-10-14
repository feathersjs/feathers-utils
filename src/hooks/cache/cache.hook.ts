import type {
  HookContext,
  Id,
  NextFunction,
  Params,
} from '@feathersjs/feathers'
import { stringifyParams } from '../../utils/stringify-params/stringify-params.util.js'
import { getResultIsArray } from '../../utils/get-result-is-array/get-result-is-array.util.js'
import { toArray } from '../../common/index.js'
import { copy } from 'fast-copy'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { PredicateFn } from '../../types.js'

type Cache = {
  get: (key: string) => Promisable<any>
  set: (key: string, value: any) => Promisable<any>
  delete: (key: string) => Promisable<any>
  clear: () => any
  keys: () => IterableIterator<string>
}

export type CacheEvent =
  | { type: 'hit'; method: string; key: string }
  | { type: 'miss'; method: string; key: string }
  | { type: 'set'; method: string; key: string }
  | { type: 'invalidate'; method: string; key: string }
  | { type: 'clear'; method: string }
  | { type: 'skip'; method: string }

export type CacheOptions<H extends HookContext = HookContext> = {
  /**
   * The cache implementation to use. It should implement the methods `get`,
   * `set`, `delete`, `clear`, and `keys` - e.g. an `LRUCache` from `lru-cache`,
   * a `Map`, or an adapter to Redis.
   *
   * Bound its size: the client chooses the `find` params (`$skip`, search
   * terms, ...), so with a plain `Map` every distinct query stays in memory
   * until the next write to the service.
   *
   * @example new LRUCache({ max: 500 })
   */
  map: Cache
  /**
   * The id field of the items, read to invalidate cached `get`s. Only a
   * fallback for services without `options.id`: a service that has one (every
   * database adapter) uses it, since that is the field `get` is called with.
   *
   * @default 'id'
   */
  id?: string
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
   *   map: new LRUCache({ max: 500 }),
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
   * clear, skip). Useful for debugging and monitoring cache behavior. The
   * events of the hook's `invalidate` function carry `method: 'invalidate'`.
   *
   * @example
   * ```ts
   * cache({
   *   map: new LRUCache({ max: 500 }),
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
   *   map: new LRUCache({ max: 500 }),
   *   transformParams: (params) => ({ query: params.query }),
   *   iff: isProvider('server'),
   * })
   * ```
   */
  iff?: boolean | PredicateFn<H>
}

/**
 * The hook {@link cache} returns: usable as a `before`, `after` or `around`
 * hook, with an `invalidate` function for the writes it does not see.
 */
export type CacheHook<H extends HookContext = HookContext> = {
  (context: H, next?: NextFunction): Promise<void>
  /**
   * Invalidates the cache after a write the hook does not see - by `_patch`
   * & co., or straight to the database: deletes the cached `get`s of `ids` and
   * every cached `find`. Without `ids`, the whole cache is cleared; an empty
   * list deletes only the `find`s.
   *
   * Pass the ids as `get` is called with them - an `ObjectId` is matched by its
   * string form.
   *
   * @example
   * ```ts
   * await app.service('todos')._patch(1, { done: true })
   * await todosCache.invalidate(1)
   * ```
   */
  invalidate: (ids?: MaybeArray<Id | object>) => Promise<void>
}

/**
 * Caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`,
 * `patch`, `remove`), affected cache entries are automatically invalidated.
 * Works as a `before`, `after`, or `around` hook.
 *
 * Use the `iff` option to restrict *caching* to certain calls (e.g. internal
 * ones) — invalidation always runs, for every call. For writes that skip the
 * hooks (`_patch` & co.), call the returned hook's `invalidate`.
 *
 * @example
 * ```ts
 * import { cache } from 'feathers-utils/hooks'
 * import { LRUCache } from 'lru-cache'
 *
 * app.service('users').hooks({
 *   around: {
 *     all: [
 *       cache({
 *         map: new LRUCache({ max: 500 }),
 *         transformParams: (params) => ({ query: params.query }),
 *       }),
 *     ],
 *   },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/cache.html
 */
export const cache = <H extends HookContext = HookContext>(
  options: CacheOptions<H>,
): CacheHook<H> => {
  const cacheMap = new ContextCacheMap(options)

  const hook = async (context: H, next?: NextFunction): Promise<void> => {
    if (context.type === 'before') {
      return await cacheBefore(context, cacheMap)
    }
    if (context.type === 'after') {
      return await cacheAfter(context, cacheMap)
    }

    if (context.type === 'around' && next) {
      await cacheBefore(context, cacheMap)
      await next()
      await cacheAfter(context, cacheMap)
      return
    }
  }

  const invalidate: CacheHook<H>['invalidate'] = async (ids) => {
    if (ids == null) {
      await cacheMap.clearAll('invalidate')
    } else {
      await cacheMap.invalidate('invalidate', toArray(ids))
    }
  }

  return Object.assign(hook, { invalidate })
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

class ContextCacheMap {
  map: Cache
  private delimiter = ':'
  private options: CacheOptions<any>
  private log: ((event: CacheEvent) => void) | undefined
  private serialize: (params: Params) => string
  private clone: <T>(value: T) => T
  private iff: boolean | PredicateFn<any>
  /** The calls served from the cache, whose result `set` must not store again. */
  private hits = new WeakSet<HookContext>()

  constructor(options: CacheOptions<any>) {
    this.map = options.map
    this.options = options
    this.log = options.logger
    this.serialize = options.serialize ?? stringifyParams
    this.iff = options.iff ?? true
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

  private stringifyCacheKey(context: HookContext) {
    if (context.method !== 'get' && context.method !== 'find') {
      throw new Error(
        `Cache can only be used with 'get' or 'find' methods, not '${context.method}'`,
      )
    }

    const stringifiedParams = this.serialize(
      this.options.transformParams(context.params ?? {}),
    )

    return `${context.id ?? 'null'}${this.delimiter}${stringifiedParams}`
  }

  private getCachedId(key: string) {
    const index = key.indexOf(this.delimiter)
    if (index === -1) {
      throw new Error(
        `Cache key '${key}' does not contain a delimiter '${this.delimiter}'`,
      )
    }
    return key.substring(0, index)
  }

  private getId(item: Record<string, any>, context: HookContext) {
    const idField = context.service.options?.id || this.options.id || 'id'
    const id = item[idField]
    return id && id.toString ? id.toString() : id
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
      this.hits.add(context)
      this.log?.({ type: 'hit', method: context.method, key })
      return this.clone(result) // clone to avoid mutation of the cached result
    }
    this.log?.({ type: 'miss', method: context.method, key })
  }

  /**
   * Called after get() and find()
   *
   * Caches the result for the given context - unless it was served from the
   * cache: storing it again would only cost a key and a clone, and reset the
   * entry's TTL, so a frequently read entry would never expire.
   */
  async set(context: HookContext) {
    if (this.hits.delete(context)) {
      return
    }

    const key = this.stringifyCacheKey(context)
    this.log?.({ type: 'set', method: context.method, key })
    // clone to avoid later mutation of the cached result
    return this.map.set(key, this.clone(context.result))
  }

  // Called after create(), update(), patch(), and remove()
  async clear<H extends HookContext>(context: H): Promise<H> {
    const { result: results } = getResultIsArray(context)

    const itemIds = results
      .map((item: any) => this.getId(item, context))
      .filter((id: any) => id != null)

    // the written items are unknown, so clear the entire cache to avoid stale
    // data: no result, items without ids, or none at all - which does not mean
    // nothing changed, adapters can skip returning them (`$returning: false`
    // in feathers-sequelize, `kysely.returning: false` in feathers-kysely)
    if (!itemIds.length) {
      await this.clearAll(context.method)
      return context
    }

    await this.invalidate(context.method, itemIds)

    return context
  }

  async clearAll(method: string) {
    this.log?.({ type: 'clear', method })
    await this.map.clear()
  }

  /**
   * Deletes every cached `find` and - unless `method` is `create` - the cached
   * `get`s of `ids`.
   */
  async invalidate(method: string, ids: readonly unknown[]) {
    const promises: Promise<any>[] = []

    // O(1) membership instead of an O(ids) scan per cached key.
    const idSet = new Set<string>(ids.map((id) => `${id}`))

    for (const key of this.map.keys()) {
      const cachedId = this.getCachedId(key)
      if (cachedId === 'null') {
        // This is a cached `find` request. Any create/patch/update/del
        // could affect the results of this query so it should be deleted
        this.log?.({ type: 'invalidate', method, key })
        promises.push(this.map.delete(key))
        continue
      }

      // This is a cached `get` request

      if (method === 'create') {
        // If this is a create, we don't need to delete any cached get requests
        continue
      }

      if (idSet.has(cachedId)) {
        // If the cached id matches a mutated item id, delete the cached get
        this.log?.({ type: 'invalidate', method, key })
        promises.push(this.map.delete(key))
      }
    }

    await Promise.all(promises)
  }
}
