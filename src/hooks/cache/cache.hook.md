---
title: cache
category: hooks
hook:
  type: ['before', 'after']
  method: ['find', 'get', 'create', 'update', 'patch', 'remove']
  multi: true
see:
  - utils/gateParams
---

The `cache` hook caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`, `patch`, `remove`), affected cache entries are automatically invalidated.

- Cached `get` entries are invalidated when the same id is updated, patched, or removed.
- Cached `find` entries are invalidated on any mutation, since any change could affect query results.
- `create` does not invalidate cached `get` entries (only `find`).

## Options

| Option            | Type                 | Description                                                                                                                                                                                                                                          |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map`             | `Cache`              | The cache implementation. Must implement `get`, `set`, `delete`, `clear`, and `keys`.                                                                                                                                                                |
| `id`              | `string`             | The id field to use. Defaults to `service.options.id`, then `'id'`.                                                                                                                                                                                  |
| `transformParams` | `(params) => params` | Transform params before they are used as cache key. Compose it with [`gateParams`](/utils/gate-params) to declaratively pick/drop keys and avoid false hits — see [Choosing Cache-Relevant Params](#choosing-cache-relevant-params-with-gateparams). |

## Choosing Cache-Relevant Params (with `gateParams`)

Deciding which `params` keys form the cache key is the trickiest part of caching, and the two failure modes are asymmetric:

- **False hits (dangerous):** if a key that affects the result is left out (e.g. `user`/tenant, `provider`), two semantically different requests collapse to the same key — one user can be served another user's cached data.
- **False misses (wasteful):** if a per-request/metrics key is included (e.g. `rateLimit`), every request produces a unique key and the cache never hits. A function-valued key (e.g. `stashed` from `stashable`) would even make serialization throw.

The [`gateParams`](/utils/gate-params) utility makes this explicit and safe. It takes a declarative path schema (`true` include, `false` drop, or a predicate/projection function). `query` is always included by default, and keys you never classified are **kept by default** — the safe direction, since a forgotten key causes at worst a harmless cache miss, never a false hit.

> Transient keys that feathers-utils' own hooks attach to `params` — `rateLimit` (`rateLimit`), `skipHooks` (`skippable`/`addSkip`), the `stashed` function and `_stashable` flag (`stashable`) — are never cache-relevant. Drop them with `false`, or keep only what you list via `dropUnknownParams: true`.

### Exclude specific params (default)

Cache on everything except the keys you explicitly drop with `false`. This is the default direction — safe against false hits:

```ts
import { gateParams } from 'feathers-utils/utils'

cache({
  map: new Map(),
  transformParams: (params) =>
    gateParams(params, { rateLimit: false, skipHooks: false }),
})
```

### Include only specific params

Set `dropUnknownParams: true` so only `query` (always) and the listed paths form the cache key. `user.id` is picked via dot-notation so different tenants never collide and per-request `user` fields don't bloat the key. Use `onUnknownParams` to log anything that was dropped:

```ts
import { gateParams } from 'feathers-utils/utils'

cache({
  map: new Map(),
  transformParams: (params) =>
    gateParams(
      params,
      { 'user.id': true }, // `query` is included automatically
      {
        dropUnknownParams: true,
        onUnknownParams: (keys) =>
          keys.forEach((key) => logger.warn('undeclared cache param', key)),
      },
    ),
})
```

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

## Examples of storages

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
        'Use clear() for full invalidation instead.',
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
