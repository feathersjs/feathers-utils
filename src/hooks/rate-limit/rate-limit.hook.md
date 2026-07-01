---
title: rateLimit
category: hooks
hook:
  type: ['before', 'around']
  method: ['find', 'get', 'create', 'update', 'patch', 'remove']
  multi: true
---

The `rateLimit` hook limits how many times a service method can be called within a time window using [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible). You provide a pre-configured rate limiter instance — the hook calls `consume()` on each request and throws a `TooManyRequests` error when the limit is exceeded.

Any rate limiter backend supported by `rate-limiter-flexible` can be used (Memory, Redis, Mongo, Postgres, etc.).

## Options

| Option   | Type                              | Description                                                                                                                                                            |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`    | `string \| ((context) => string)` | The rate-limiting key, or a function to derive it from the context. Defaults to `context.path`. Pass a static string for a single shared bucket (a global rate limit). |
| `points` | `number \| ((context) => number)` | Number of points to consume per request, or a function to compute it from the context. Defaults to `1`.                                                                |

The `RateLimiterRes` is stored on `context.params.rateLimit` on both success and failure, so downstream hooks or services can inspect `remainingPoints`, `consumedPoints`, `msBeforeNext`, etc.

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
