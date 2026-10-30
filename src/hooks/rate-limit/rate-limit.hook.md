---
title: rateLimit
category: hooks
tags:
  - authorization
options: RateLimitOptions
hook:
  type: ['before', 'around']
  method: ['find', 'get', 'create', 'update', 'patch', 'remove']
  multi: true
---

The `rateLimit` hook limits how many times a service method can be called within a time window using [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible). You provide a pre-configured rate limiter instance — the hook calls `consume()` on each request and throws a `TooManyRequests` error when the limit is exceeded.

Any rate limiter backend supported by `rate-limiter-flexible` can be used (Memory, Redis, Mongo, Postgres, etc.).

<!-- options -->

The `RateLimiterRes` is stored on `context.params.rateLimit` on both success and failure, so downstream hooks or services can inspect `remainingPoints`, `consumedPoints`, `msBeforeNext`, etc.

A rejection's `TooManyRequests` carries `data.retryAfter`, the seconds until the next call may pass, so a socket client can say when to try again.

## Headers

With `headers`, a REST response tells the client where it stands. The formats follow [`express-rate-limit`](https://express-rate-limit.mintlify.app/reference/configuration#standardheaders): `'legacy'` for the widespread `X-RateLimit-*` headers, `'draft-6'`, `'draft-7'` or `'draft-8'` for that version of the IETF [RateLimit header fields draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), or a function for a scheme of your own, such as `X-RateLimit-Remaining-Requests`.

Send them only where the bucket is the caller's own, keyed per user or IP. On a shared bucket (a static `key`, or the default `context.path`) `remaining` tells every caller how much everyone else is calling. On a login or another brute-force target, they help an attacker pace just under the limit; send no `headers` there and let `data.retryAfter` say when to try again.

A rejection adds `Retry-After`. Feathers' REST error handlers send only the error's status and body, not the headers hooks set, so the hook puts them on `error.data.headers` as well. Send them from a middleware before the error handler:

```ts
// Express
app.use((error, req, res, next) => {
  if (error.data?.headers) res.set(error.data.headers)
  next(error)
})
app.use(errorHandler())

// Koa, after `app.use(errorHandler())`
app.use(async (ctx, next) => {
  try {
    await next()
  } catch (error) {
    if (error.data?.headers) ctx.set(error.data.headers)
    throw error
  }
})
```

## Examples

### Basic Usage

```ts
import { rateLimit } from 'feathers-utils/hooks'
import { RateLimiterMemory } from 'rate-limiter-flexible'

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests
  duration: 1, // per 1 second
})

app.service('users').hooks({
  before: {
    find: [rateLimit(rateLimiter)],
  },
})
```

### Headers for REST Clients

```ts
app.service('messages').hooks({
  before: {
    create: [rateLimit(rateLimiter, { headers: 'draft-8' })],
  },
})
```

### Rate Limit per User

Use the `key` option to rate limit per authenticated user instead of per service path:

```ts
const rateLimiter = new RateLimiterMemory({ points: 100, duration: 60 })

app.service('messages').hooks({
  before: {
    create: [
      rateLimit(rateLimiter, {
        key: (context) => `${context.path}:${context.params.user?.id}`,
      }),
    ],
  },
})
```

### Global Rate Limit

Pass a static string as the `key` to share a single bucket across all requests — a global cap on an endpoint instead of one bucket per `context.path`:

```ts
const rateLimiter = new RateLimiterMemory({ points: 1000, duration: 60 })

app.service('search').hooks({
  before: {
    find: [rateLimit(rateLimiter, { key: 'search' })],
  },
})
```

### Custom Points per Request

Pass a static number to consume a fixed cost per request:

```ts
app.service('reports').hooks({
  before: {
    find: [rateLimit(rateLimiter, { points: 5 })],
  },
})
```

Or pass a function to compute the cost from the context — e.g. to charge more for expensive queries:

```ts
app.service('reports').hooks({
  before: {
    find: [
      rateLimit(rateLimiter, {
        points: (context) => (context.params.query?.$limit > 100 ? 5 : 1),
      }),
    ],
  },
})
```

### Redis Backend

```ts
import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'

const redisClient = new Redis()

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 100,
  duration: 60,
  keyPrefix: 'rl',
})

app.service('users').hooks({
  before: {
    find: [rateLimit(rateLimiter)],
  },
})
```

### Bypass with iff

Use [`iff`](/hooks/iff.html) to skip rate limiting for internal (server-side) calls:

```ts
import { rateLimit, iff } from 'feathers-utils/hooks'
import { isProvider } from 'feathers-utils/predicates'

app.service('users').hooks({
  before: {
    find: [
      iff(isProvider('rest', 'socketio', 'external'), rateLimit(rateLimiter)),
    ],
  },
})
```

### Bypass with skippable

Use [`skippable`](/hooks/skippable.html) to allow specific callers to opt out of rate limiting:

```ts
import { rateLimit, skippable } from 'feathers-utils/hooks'

app.service('users').hooks({
  before: {
    find: [skippable(rateLimit(rateLimiter))],
  },
})

// Skip rate limiting for this call
app.service('users').find({ skipHooks: ['rateLimit'] })
```
