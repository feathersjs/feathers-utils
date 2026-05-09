---
title: throttle
category: hooks
hook:
  type: ["around"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
---

The `throttle` hook routes service method calls through a pluggable throttle backend that enforces concurrency, queueing, and (optionally) a token-bucket rate limit. It is designed for services that **call out** to external APIs with quotas — Stripe, Google, OpenWeatherMap, etc. — where you must not exceed the upstream budget but you also do not want to fail your users on every burst.

`throttle` is the complement of [`rateLimit`](/hooks/rate-limit.html):

| | `rateLimit` | `throttle` |
| --- | --- | --- |
| Behavior when over budget | **Rejects** with `TooManyRequests` | **Queues** and waits |
| Typical use | Protect *your* service from abusive callers | Stay within an *upstream* API quota |
| Concurrency limiting | No | Yes (`maxConcurrent`) |
| Hard ceiling on the queue | n/a | Yes (`maxQueueSize` → `TooManyRequests`) |
| Hard ceiling on wait time | n/a | Yes (`queueTimeoutMs` → `Timeout`) |

`throttle` must be registered as an `around` hook because the queue slot has to be held for the full duration of the downstream service call.

## Options

| Option | Type | Description |
| --- | --- | --- |
| `key` | `(context) => string` | Generate the throttle key. Defaults to `context.path`. Use this to give different external APIs (or different users) independent budgets. |

The throttle backend itself is passed as the first argument and carries its own configuration.

## `MemoryThrottle`

The built-in in-memory implementation. Coordinates within a single Node process — sufficient for most apps. For multi-instance deployments see [Distributed coordination](#distributed-coordination) below.

| Option | Type | Description |
| --- | --- | --- |
| `maxConcurrent` | `number` | Max in-flight tasks per key (semaphore). Defaults to `Infinity`. |
| `maxQueueSize` | `number` | Max waiters per key. When exceeded, `schedule` throws `TooManyRequests`. Defaults to `Infinity`. |
| `reservoir` | `number` | Token-bucket: tokens available per `reservoirIntervalMs`. One token per task. Defaults to `Infinity` (disabled). |
| `reservoirIntervalMs` | `number` | Refill window in milliseconds. Required if `reservoir` is set. |
| `queueTimeoutMs` | `number` | Max time a task may wait in the queue before being rejected with `Timeout`. Defaults to `Infinity`. |

## Examples

### Stripe-style: 5 concurrent, 100 calls per second

```ts
import { throttle, MemoryThrottle } from 'feathers-utils/hooks'

const stripeThrottle = new MemoryThrottle({
  maxConcurrent: 5,
  reservoir: 100,
  reservoirIntervalMs: 1_000,
})

app.service('payments').hooks({
  around: {
    create: [throttle(stripeThrottle)],
    find: [throttle(stripeThrottle)],
  },
})
```

### OpenWeatherMap-style: 60 calls per minute, fail fast on backlog

If your free-tier quota is 60 calls/minute and you would rather error than let users wait more than 5 seconds, cap the queue and the wait:

```ts
const weatherThrottle = new MemoryThrottle({
  maxConcurrent: 10,
  reservoir: 60,
  reservoirIntervalMs: 60_000,
  maxQueueSize: 50,
  queueTimeoutMs: 5_000,
})

app.service('weather').hooks({
  around: {
    find: [throttle(weatherThrottle)],
    get: [throttle(weatherThrottle)],
  },
})
```

Callers that arrive after the queue is full get `TooManyRequests`; callers that wait longer than 5 seconds get `Timeout`.

### Per-user throttling

Use `key` to give each user their own budget instead of sharing one across the whole service:

```ts
app.service('reports').hooks({
  around: {
    find: [
      throttle(throttler, {
        key: (context) => `${context.path}:${context.params.user?.id}`,
      }),
    ],
  },
})
```

### One throttle for many services

A single `MemoryThrottle` instance can throttle several services independently — each `key` gets its own concurrency counter, queue, and reservoir:

```ts
const googleThrottle = new MemoryThrottle({
  maxConcurrent: 10,
  reservoir: 1_000,
  reservoirIntervalMs: 60_000,
})

app.service('places').hooks({
  around: { find: [throttle(googleThrottle, { key: () => 'google:places' })] },
})

app.service('geocoding').hooks({
  around: { find: [throttle(googleThrottle, { key: () => 'google:geocoding' })] },
})
```

### Bypass with `iff`

Skip throttling for internal (server-side) calls:

```ts
import { throttle, iff } from 'feathers-utils/hooks'
import { isProvider } from 'feathers-utils/predicates'

app.service('weather').hooks({
  around: {
    find: [
      iff(isProvider('rest', 'socketio', 'external'), throttle(throttler)),
    ],
  },
})
```

## Distributed coordination

`MemoryThrottle` lives inside a single Node process. If you run multiple Feathers instances behind a load balancer and need them to share **one** upstream quota, implement the `ThrottleAbstract` interface yourself against Redis (or wrap a clustered library such as [Bottleneck](https://github.com/SGrondin/bottleneck)):

```ts
import type { ThrottleAbstract } from 'feathers-utils/hooks'
import Bottleneck from 'bottleneck'

class BottleneckThrottle implements ThrottleAbstract {
  private readonly groups = new Map<string, Bottleneck>()

  constructor(private readonly factory: (key: string) => Bottleneck) {}

  schedule<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let limiter = this.groups.get(key)
    if (!limiter) {
      limiter = this.factory(key)
      this.groups.set(key, limiter)
    }
    return limiter.schedule(fn)
  }
}

const throttler = new BottleneckThrottle((key) =>
  new Bottleneck({
    id: `feathers:${key}`,
    datastore: 'ioredis',
    clientOptions: { host: 'redis' },
    maxConcurrent: 5,
    reservoir: 100,
    reservoirRefreshAmount: 100,
    reservoirRefreshInterval: 1_000,
  }),
)
```

The `throttle` hook itself is unchanged — it only depends on the `ThrottleAbstract` interface.
