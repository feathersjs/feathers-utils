---
title: cache
category: hooks
hook:
  type: ["before", "after"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
---

The `cache` hook caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`, `patch`, `remove`), affected cache entries are automatically invalidated.

- Cached `get` entries are invalidated when the same id is updated, patched, or removed.
- Cached `find` entries are invalidated on any mutation, since any change could affect query results.
- `create` does not invalidate cached `get` entries (only `find`).

## Options

| Option | Type | Description |
| --- | --- | --- |
| `map` | `Cache` | The cache implementation. Must implement `get`, `set`, `delete`, `clear`, and `keys`. |
| `id` | `string` | The id field to use. Defaults to `service.options.id`, then `'id'`. |
| `transformParams` | `(params) => params` | Transform params before they are used as cache key. Use this to exclude properties like `paginate` or `user` from the cache key. |

## Cache Interface

Any object that implements the following interface can be used as a cache:

```ts
type Cache = {
  get: (key: string) => Promisable<any>
  set: (key: string, value: any) => Promisable<any>
  delete: (key: string) => Promisable<any>
  clear: () => any
  keys: () => Generator<string, void, unknown>
}
```

A plain `Map` satisfies this interface out of the box, as do many popular cache libraries.

## Examples

### Basic Usage with Map

```ts
import { cache } from 'feathers-utils/hooks'

const myCache = new Map()

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: myCache,
        transformParams: (params) => ({ query: params.query }),
      }),
    ],
  },
})
```

### LRU Cache (lru-cache)

Use [lru-cache](https://github.com/isaacs/node-lru-cache) to limit the number of cached entries and automatically evict the least recently used ones.

```ts
import { cache } from 'feathers-utils/hooks'
import { LRUCache } from 'lru-cache'

const lruCache = new LRUCache({
  max: 500, // Maximum number of entries
  ttl: 1000 * 60 * 5, // Entries expire after 5 minutes
})

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: lruCache,
        transformParams: (params) => ({ query: params.query }),
      }),
    ],
  },
})
```

### Redis

Redis (via [ioredis](https://github.com/redis/ioredis)) requires a thin adapter since its API is slightly different from the `Cache` interface.

```ts
import { cache } from 'feathers-utils/hooks'
import Redis from 'ioredis'

const redis = new Redis()
const prefix = 'users-cache:'
const ttl = 60 * 5 // 5 minutes in seconds

const redisCache = {
  async get(key: string) {
    const value = await redis.get(prefix + key)
    return value ? JSON.parse(value) : undefined
  },
  async set(key: string, value: any) {
    await redis.set(prefix + key, JSON.stringify(value), 'EX', ttl)
  },
  async delete(key: string) {
    await redis.del(prefix + key)
  },
  async clear() {
    const keys = await redis.keys(prefix + '*')
    if (keys.length) await redis.del(...keys)
  },
  *keys() {
    // Redis keys() is async, so we track keys locally for invalidation.
    // For production use, consider maintaining a local Set of active keys.
    throw new Error(
      'Synchronous keys iteration is not supported with Redis. ' +
      'Use clear() for full invalidation instead.'
    )
  },
}

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: redisCache,
        transformParams: (params) => ({ query: params.query }),
      }),
    ],
  },
})
```

::: warning
The `keys()` method is called during invalidation of mutating methods to find entries that match the affected ids. Since Redis does not support synchronous iteration, the adapter above throws on `keys()`. This means mutations will fail unless you provide a working `keys()` implementation — for example by tracking active keys in a local `Set`:
:::

```ts
const trackedKeys = new Set<string>()

const redisCache = {
  async get(key: string) {
    const value = await redis.get(prefix + key)
    return value ? JSON.parse(value) : undefined
  },
  async set(key: string, value: any) {
    trackedKeys.add(key)
    await redis.set(prefix + key, JSON.stringify(value), 'EX', ttl)
  },
  async delete(key: string) {
    trackedKeys.delete(key)
    await redis.del(prefix + key)
  },
  async clear() {
    const keys = [...trackedKeys]
    trackedKeys.clear()
    if (keys.length) await redis.del(...keys.map((k) => prefix + k))
  },
  *keys() {
    yield* trackedKeys
  },
}
```

### Custom Cache

You can build any custom cache as long as it implements the `Cache` interface. Here is an example of a simple time-based cache:

```ts
import { cache } from 'feathers-utils/hooks'

const ttl = 1000 * 60 * 5 // 5 minutes

const timedCache = () => {
  const store = new Map<string, { value: any; expires: number }>()

  return {
    get(key: string) {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expires) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key: string, value: any) {
      store.set(key, { value, expires: Date.now() + ttl })
    },
    delete(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    *keys() {
      yield* store.keys()
    },
  }
}

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: timedCache(),
        transformParams: (params) => ({ query: params.query }),
      }),
    ],
  },
})
```

### Excluding Params from Cache Key

Use `transformParams` to exclude properties that should not affect the cache key, such as `paginate`, `user`, or authentication info:

```ts
cache({
  map: new Map(),
  transformParams: (params) => {
    const { paginate, user, authentication, ...rest } = params as any
    return rest
  },
})
```
