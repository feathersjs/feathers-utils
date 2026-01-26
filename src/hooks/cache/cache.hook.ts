import type { HookContext, NextFunction, Params } from '@feathersjs/feathers'
import { stableStringify } from './cache-utils.js'
import { copy } from 'fast-copy'
import type { Promisable } from '../../internal.utils.js'

type Cache = {
  get: (key: string) => Promisable<any>
  set: (key: string, value: any) => Promisable<any>
  delete: (key: string) => Promisable<any>
  clear: () => any
  keys: () => Generator<string, void, unknown>
}

export type CacheOptions = {
  /**
   * The cache implementation to use. It should implement the methods `get`, `set`, `delete`, `clear`, and `keys`.
   * This can be a Map, Redis client, or any other cache implementation.
   *
   * Use 'lru-cache' for an LRU cache implementation.
   */
  map: Cache
  /**
   * The id field to use for caching. Defaults to `service.options.id` and if not found, then 'id'.
   */
  id?: string
  /**
   * params are stringified for the key-value cache.
   * There are params properties you don't want to include in the cache key.
   * You can use this function to transform the params before they are stringified.
   */
  transformParams: (params: Params) => Params
}

export const cache = <H extends HookContext = HookContext>(
  options: CacheOptions,
) => {
  const cacheMap = new ContextCacheMap(options)
  return async (context: H, next?: NextFunction) => {
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
}

const cacheBefore = async (context: HookContext, cacheMap: ContextCacheMap) => {
  if (context.method === 'get' || context.method === 'find') {
    const value = await cacheMap.get(context)
    if (value) {
      context.result = value
    }
  }

  return context
}

const cacheAfter = async (context: HookContext, cacheMap: ContextCacheMap) => {
  if (context.method === 'get' || context.method === 'find') {
    await cacheMap.set(context)
  } else {
    await cacheMap.clear(context)
  }

  return context
}

class ContextCacheMap {
  map: Cache
  private delimiter = ':'
  private options: CacheOptions

  constructor(options: CacheOptions) {
    this.map = options.map
    this.options = options
  }

  private stringifyCacheKey(context: HookContext) {
    if (context.method !== 'get' && context.method !== 'find') {
      throw new Error(
        `Cache can only be used with 'get' or 'find' methods, not '${context.method}'`,
      )
    }

    const stringifiedParams = stableStringify(
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
    const result = this.map.get(key)
    if (result) {
      return copy(result) // Use copy to avoid mutation of the original result
    }
  }

  /**
   * Called after get() and find()
   *
   * Caches the result for the given context.
   */
  async set(context: HookContext) {
    const key = this.stringifyCacheKey(context)
    return this.map.set(key, copy(context.result)) // Use copy to avoid mutation of the original result
  }

  // Called after create(), update(), patch(), and remove()
  async clear<H extends HookContext>(context: H): Promise<H> {
    const results = Array.isArray(context.result)
      ? context.result
      : [context.result]

    const promises: Promise<any>[] = []

    const itemIds = results
      .map((item: any) => this.getId(item, context))
      .filter(Boolean)

    // If no itemIds are found, clear the entire cache to avoid stale data
    if (!itemIds.length) {
      await this.map.clear()
      return context
    }

    for (const key of this.map.keys()) {
      const cachedId = this.getCachedId(key)
      if (cachedId === 'null') {
        // This is a cached `find` request. Any create/patch/update/del
        // could affect the results of this query so it should be deleted
        promises.push(this.map.delete(key))
        continue
      }

      // This is a cached `get` request

      if (context.method === 'create') {
        // If this is a create, we don't need to delete any cached get requests
        continue
      }

      for (const itemId of itemIds) {
        if (cachedId === itemId) {
          // If the cached id matches the item id, delete the cached get
          promises.push(this.map.delete(key))
        }
      }
    }

    await Promise.all(promises)

    return context
  }
}
