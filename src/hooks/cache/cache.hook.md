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
  - hooks/setField
  - utils/gateParams
  - utils/stringifyParams
  - predicates/isProvider
---

The `cache` hook caches `get` and `find` results based on `params`. On mutating methods (`create`, `update`, `patch`, `remove`), affected cache entries are automatically invalidated.

- Cached `get` entries are invalidated when the same id is updated, patched, or removed.
- Cached `find` entries are invalidated on any mutation, since any change could affect query results.
- `create` does not invalidate cached `get` entries (only `find`).
- The `iff` option restricts *which calls are cached* (e.g. internal ones only); invalidation always runs.
- The `scope` option confines invalidation to a tenant, so a mutation in one tenant leaves the other tenants' cached `find` results alone.

<!-- options -->

## Caching Only Some Calls (`iff`)

`iff` gates the cache for `get` and `find`: when it is falsy for a call, the call is neither served from the cache nor stored in it. It takes a boolean or a (possibly async) predicate over the `HookContext`, so any [predicate](/predicates/) composes — e.g. [`isProvider`](/predicates/is-provider), [`isContext`](/predicates/is-context), or a combination via [`and`](/predicates/and) / [`or`](/predicates/or) / [`not`](/predicates/not).

```ts
import { cache } from 'feathers-utils/hooks'
import { isProvider } from 'feathers-utils/predicates'

app.service('users').hooks({
  around: {
    all: [
      cache({
        map: new Map(),
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

## Scoping Invalidation per Tenant (`scope`)

In a multi-tenant app every row carries a `companyId` (or `userId`, or `locale`, …) and every call is confined to one of them. Without `scope`, a single `create` invalidates **every** cached `find` of **every** tenant — with many tenants the cache barely ever hits.

`scope` fixes that. It is one function that you branch on `context.method`: for `get`/`find` it returns the scope the result is confined to, for mutations every scope the mutation may affect.

```ts
import { cache } from 'feathers-utils/hooks'
import { getResultIsArray } from 'feathers-utils/utils'

const mayChangeCompany = (data: any) =>
  (Array.isArray(data) ? data : [data]).some(
    (item) =>
      item &&
      ('companyId' in item ||
        // `$set` / `$unset` / `$inc` can move a row too
        Object.keys(item).some((key) => key.startsWith('$'))),
  )

app.service('orders').hooks({
  before: {
    all: [
      // pins `companyId` onto every query
      setField({ from: 'params.user.companyId', as: 'params.query.companyId' }),
    ],
  },
  around: {
    all: [
      cache({
        map,
        transformParams: ({ query }) => ({ query }),
        scope: (context) => {
          if (context.method === 'get' || context.method === 'find') {
            // only scope when the query really pins the tenant down
            return context.params.query?.companyId
          }

          // `update` replaces the row, so the company may change or be dropped
          if (context.method === 'update') return undefined

          // a `patch` could move items into another company
          if (context.method === 'patch' && mayChangeCompany(context.data)) {
            return undefined
          }

          return getResultIsArray(context).result.map((item) => item.companyId)
        },
      }),
    ],
  },
})
```

A `create` in company `a` now drops company `a`'s cached `find` entries and leaves company `b`'s alone.

### The contract

Returning a scope is a **promise**: only mutations in that scope can change this result. If you cannot vouch for that, return `undefined` — and when in doubt, do.

The scope is read from the raw `context.params`, before `transformParams` runs, and from `context.result` for mutations. Resolution is synchronous: a wrong scope corrupts *invalidation*, not just a cache hit, so a round-trip has no place in that path. A thrown error is caught, never propagated, and treated as `undefined`.

### Result items or query?

The recipe above derives the mutation's scopes from the **result items**, and that is the right default: they carry the actual scope of every row the call touched, however the call was addressed. A `patch(1, data)` has no query at all and still yields the row's `companyId`, and a `patch(null, data, { query: { status: 'open' } })` yields exactly the tenants that were really hit — not the ones the query would have allowed.

The **query** is the fallback for the one case the result cannot cover: `$select` stripped the scope field. It is only safe when the query *pins* the scope — a plain equality, or an `$in` list you return as an array. A `$ne`, a `$nin` or a missing scope field pins nothing, so return `undefined` there.

```ts
const scopesFromResult = (context: HookContext) =>
  getResultIsArray(context).result.map((item) => item.companyId)

const scopesFromQuery = (context: HookContext) => {
  const companyId = context.params.query?.companyId
  if (typeof companyId === 'string') return companyId
  // an `$in` list is a set of pinned scopes — anything else pins nothing
  if (Array.isArray(companyId?.$in)) return companyId.$in
  return undefined
}

// …inside the resolver, for create/patch/remove:
const scopes = scopesFromResult(context)
return scopes.every(Boolean) ? scopes : scopesFromQuery(context)
```

### Falling back is always safe

There are three levels, and the middle one is exactly what the hook does **without** a `scope` option:

| Level | Effect | When |
| --- | --- | --- |
| scoped | drops the affected scopes' `find` entries **plus every unscoped one**; `get` entries by id | the scope is known |
| unscoped | drops **every** `find` entry; `get` entries by id | the scope is unknown, the resolver threw, or you returned `undefined` |
| full clear | `map.clear()` | the affected ids are unknown |

So **enabling `scope` never invalidates less than the default.** An entry stored without a resolvable scope is invalidated by every mutation, and a scoped mutation still clears those unscoped entries — otherwise an entry written once would go stale forever.

::: warning Four ways to lose the scope
1. **`update` replaces the row.** If `data` omits the scope field it is dropped or defaulted — that is a scope change too. Return `undefined` for `update`.
2. **`patch` with operator data.** `'companyId' in data` does not catch `{ $set: { companyId: 'b' } }`. Check for `$`-prefixed keys as well.
3. **`$select` strips the scope field** from the result items (`patch(id, data, { query: { $select: ['id'] } })`). The scope then resolves to `undefined` and invalidation degrades to unscoped — correct, but silently useless. Include the scope field in your `$select`, or accept it. A `null` scope (a row shared across tenants) degrades the same way, which is right: a shared row really does affect every tenant.
4. **Another hook rewrote the field.** The resolver sees `context.result` as the cache hook sees it. A hook registered *before* it in the `after` chain can strip the scope field (harmless — unscoped) or *rewrite* it (dangerous — a wrong scope under-invalidates). Register `cache` first in `after`, or as an `around` at the top, and never scope on a field another hook rewrites.
:::

### Watching for silent degradation

The unscoped fallback does **not** call `map.clear()` — it emits the same `invalidate` events a healthy scoped run does. To make it visible, every fallback emits a `degrade` event carrying a `reason`:

```ts
cache({
  map,
  transformParams: ({ query }) => ({ query }),
  scope: companyScope,
  logger: (event) => {
    if (event.type === 'degrade') {
      logger.warn(`cache scope degraded on ${event.method}`, event.reason)
    }
  },
})
```

| `reason` | Meaning |
| --- | --- |
| `no-scope` | the resolver returned nothing usable (`undefined`, an empty array, or a non-primitive) |
| `scope-error` | the resolver threw |
| `no-ids` | the affected ids could not be determined — this one comes with a `clear` event, not a `degrade` |

A `degrade` is only ever emitted when `scope` is configured. Like `skip`, a read-path `degrade` fires on every hook run it covers — twice per `get`/`find` call with a `before`/`after` or `around` registration.

## Cache Key Format

A key has two segments, or three once `scope` is configured:

```
without scope:  <id|null>:<serializedParams>
with scope:     <scope|empty>:<id|null>:<serializedParams>
```

- `null` in the id segment marks a cached `find`; an empty scope segment marks an unscoped entry.
- The scope and id segments are URI-encoded, so a value containing `:` cannot break parsing. The serialized params are never parsed and stay untouched.
- Two harmless collisions: a literal id of `'null'` looks like a `find` entry, and a literal scope of `''` looks unscoped. Both only ever cause *extra* invalidation.

::: warning Enabling `scope` changes the key format
Entries written before you enabled it are never served — a new read computes a three-segment key, which can never equal a two-segment one — but in a persistent store (Redis) they linger until they expire. Bump your key prefix or flush the cache when you deploy the change. An in-memory `Map`/`LRUCache` is empty at boot, so there is nothing to do.
:::

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

`keys()` is iterated on every mutation to find the entries to invalidate, and the scope and id are read out of the key itself — so an adapter that tracks its keys in a local `Set` needs no changes for `scope`. `clear()` is still what runs whenever the affected ids are unknown.

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
