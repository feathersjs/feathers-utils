---
title: cache
category: hooks
tags:
  - query
  - caching
options: CacheOptions
hook:
  type: ['before', 'after']
  method: ['find', 'get', 'create', 'update', 'patch', 'remove']
  multi: true
see:
  - utils/gateParams
  - utils/stringifyParams
  - predicates/isProvider
---

The `cache` hook caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`, `patch`, `remove`), affected cache entries are automatically invalidated.

- Cached `get` entries are invalidated when the same id is updated, patched, or removed.
- Cached `find` entries are invalidated on any mutation, since any change could affect query results.
- `create` does not invalidate cached `get` entries (only `find`).
- The `iff` option restricts *which calls are cached* (e.g. internal ones only); invalidation always runs.
- When a write does not show which items it changed (no result, items without ids, or none at all, e.g. feathers-sequelize with `$returning: false`), the whole cache is cleared.

::: warning Only writes through the hooks invalidate
The hook only sees the calls that run the service's hooks. These writes leave stale entries behind until they are evicted or their `ttl` runs out:

- the adapter methods without hooks: `_create`, `_update`, `_patch` and `_remove`,
- writes straight to the database, or from another process.

Give the cache a `ttl` that bounds how stale an entry may get, and [invalidate it yourself](#invalidating-manually) after such a write.
:::

<!-- options -->

## Caching Only Some Calls (`iff`)

`iff` gates the cache for `get` and `find`: when it is falsy for a call, the call is neither served from the cache nor stored in it. It takes a boolean or a (possibly async) predicate over the `HookContext`, so any [predicate](/predicates/) composes — e.g. [`isProvider`](/predicates/is-provider), [`isContext`](/predicates/is-context), or a combination via [`and`](/predicates/and) / [`or`](/predicates/or) / [`not`](/predicates/not).

```ts
import { cache } from 'feathers-utils/hooks'
import { isProvider } from 'feathers-utils/predicates'
import { LRUCache } from 'lru-cache'

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: new LRUCache({ max: 500 }),
        transformParams: (params) => ({ query: params.query }),
        // only internal calls are served from / written to the cache
        iff: isProvider('server'),
      }),
    ],
  },
})
```

::: tip Invalidation is not gated
`iff` deliberately applies to `get`/`find` only. `create`, `update`, `patch` and `remove` always invalidate the affected entries, no matter who made the call — an external `patch` still clears the entries an internal `get` put there. Gating invalidation too would let external writes leave stale data behind.
:::

A gated-out call emits a `skip` event to the `logger`, so a cache that never fills shows up in your logs instead of failing silently. The event carries no `key` — computing one is exactly the work the gate skips.

The predicate is evaluated on every hook run it gates — with a `before`/`after` or `around` registration that is twice per `get`/`find` call (and therefore two `skip` events) — so keep it cheap and side-effect free.

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
  map: new LRUCache({ max: 500 }),
  transformParams: (params) =>
    gateParams(params, { rateLimit: false, skipHooks: false }),
})
```

### Include only specific params

Set `dropUnknownParams: true` so only `query` (always) and the listed paths form the cache key. `user.id` is picked via dot-notation so different tenants never collide and per-request `user` fields don't bloat the key. Use `onUnknownParams` to log anything that was dropped:

```ts
import { gateParams } from 'feathers-utils/utils'

cache({
  map: new LRUCache({ max: 500 }),
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

## Invalidating Manually

For the writes the hook does not see, the hook that `cache()` returns has an `invalidate` function. Given the ids of the changed items, it deletes their cached `get`s and every cached `find`. Without ids, it clears the whole cache.

```ts
import { cache } from 'feathers-utils/hooks'
import { LRUCache } from 'lru-cache'

export const todosCache = cache({
  map: new LRUCache({ max: 500 }),
  transformParams: (params) => ({ query: params.query }),
})

app.service('todos').hooks({ around: { all: [todosCache] } })

// elsewhere, past the hooks of `todos`
await app.service('todos')._patch(1, { done: true })
await todosCache.invalidate(1)

// the changed ids are unknown, e.g. after a bulk write straight to the database
await todosCache.invalidate()
```

- Pass the ids as `get` is called with them. An `ObjectId` is matched by its string form.
- An empty list deletes only the cached `find`s, e.g. after `_create`.
- The `logger` events of `invalidate` carry `method: 'invalidate'`.

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

::: warning Bound the cache
A `Map` never evicts. For external `find` calls the client chooses the params that form the key (`$skip`, search terms, `$in` lists, ...), so every distinct query stays in memory until the next write to the service. Use a cache with a size limit, like `lru-cache` below.
:::

## Examples of storages

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

The `ttl` bounds how stale an entry can get through writes the hook does not see, e.g. from another process or straight to the database. Serving an entry from the cache does not reset it.

### Map

A `Map` is enough when the set of keys is small and fixed, e.g. for a few internal calls with known params, or in tests:

```ts
import { cache } from 'feathers-utils/hooks'
import { isProvider } from 'feathers-utils/predicates'

app.service('settings').hooks({
  around: {
    all: [
      cache({
        map: new Map(),
        transformParams: (params) => ({ query: params.query }),
        iff: isProvider('server'),
      }),
    ],
  },
})
```

### Redis

Redis (via [ioredis](https://github.com/redis/ioredis)) needs a thin adapter. The hook iterates `keys()` synchronously on every write, so the adapter tracks the keys it set, together with their expiry:

```ts
import { cache } from 'feathers-utils/hooks'
import Redis from 'ioredis'

const redis = new Redis()
const prefix = 'users-cache:'
const ttl = 60 * 5 // 5 minutes in seconds

// key -> expiry, so the keys Redis expired are dropped here too
const tracked = new Map<string, number>()

const redisCache = {
  async get(key: string) {
    const value = await redis.get(prefix + key)
    return value ? JSON.parse(value) : undefined
  },
  async set(key: string, value: any) {
    tracked.set(key, Date.now() + ttl * 1000)
    await redis.set(prefix + key, JSON.stringify(value), 'EX', ttl)
  },
  async delete(key: string) {
    tracked.delete(key)
    await redis.del(prefix + key)
  },
  async clear() {
    const keys = [...tracked.keys()]
    tracked.clear()
    if (keys.length) await redis.del(...keys.map((key) => prefix + key))
  },
  *keys() {
    const now = Date.now()
    for (const [key, expires] of tracked) {
      if (expires <= now) tracked.delete(key)
      else yield key
    }
  },
}

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: redisCache,
        transformParams: (params) => ({ query: params.query }),
        // the JSON round trip already hands out a fresh copy
        clone: false,
      }),
    ],
  },
})
```

::: warning One process only
The keys are tracked per process. With several instances, a write on one does not invalidate the entries another one set: they stay until their `ttl` runs out. Keep the `ttl` short, or share the invalidation between the instances, e.g. via Redis pub/sub.
:::

### Custom Cache

You can build any custom cache as long as it implements the `Cache` interface. Here is an example of a simple time-based cache. It drops an expired entry when it is read, and on every write, when the hook iterates `keys()`:

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
      const now = Date.now()
      for (const [key, entry] of store) {
        if (now > entry.expires) store.delete(key)
        else yield key
      }
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
