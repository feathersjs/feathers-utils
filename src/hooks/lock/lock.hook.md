---
title: lock
category: hooks
hook:
  type: ["around"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
---

The `lock` hook is a per-key mutex: while one task holds the lock for a given key, any other task that resolves to the same key waits in FIFO order. Use it to serialize operations that must not interleave — updating a record that has a non-atomic read-modify-write flow, processing a webhook by external id, charging a customer, etc.

It is implemented on top of [`throttle`](/hooks/throttle.html) with `maxConcurrent: 1`. Anything `throttle` says about queueing, error propagation, and slot release applies here too.

`lock` must be registered as an `around` hook.

## Options

| Option | Type | Description |
| --- | --- | --- |
| `key` | `(context) => string` | **Required.** Generate the lock key. Locking the entire service is almost always wrong — always key on something like the record id, the user id, or an external id. |
| `timeoutMs` | `number` | Max time in milliseconds a task may wait for the lock before being rejected with `Timeout`. Defaults to `Infinity`. Only valid in the standalone form. |

## Examples

### Serialize patches to the same record

```ts
import { lock } from 'feathers-utils/hooks'

app.service('orders').hooks({
  around: {
    patch: [lock({ key: (context) => `orders:${context.id}` })],
  },
})
```

Two concurrent `patch` calls for the same `id` will run one after the other; patches to different ids still run in parallel.

### Fail fast instead of waiting forever

```ts
lock({
  key: (context) => `orders:${context.id}`,
  timeoutMs: 5_000,
})
```

Callers that wait longer than 5 seconds for the lock get a `Timeout` error.

### Share a lock across services

Two standalone `lock(...)` calls each get their own internal throttler, so they do **not** share state. To coordinate across services (or across multiple hook registrations), create a single `MemoryThrottle` and pass it in:

```ts
import { lock, MemoryThrottle } from 'feathers-utils/hooks'

const recordLocks = new MemoryThrottle({ maxConcurrent: 1 })

app.service('orders').hooks({
  around: {
    patch: [lock(recordLocks, { key: (ctx) => `order:${ctx.id}` })],
  },
})

app.service('invoices').hooks({
  around: {
    create: [
      lock(recordLocks, { key: (ctx) => `order:${ctx.data.orderId}` }),
    ],
  },
})
```

Patching an order and creating its invoice now serialize on the same key, even though they live on different services.

### Distributed locks

`MemoryThrottle` only coordinates within a single Node process. For cross-instance locks, implement `ThrottleAbstract` against Redis (see [throttle > Distributed coordination](/hooks/throttle.html#distributed-coordination)) and pass that instance into `lock`.
