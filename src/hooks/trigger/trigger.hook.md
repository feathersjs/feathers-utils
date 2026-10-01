---
title: trigger
category: hooks
tags:
  - data
  - result
  - multi
options: TriggerSubscriptionOptions
hook:
  type: ['before', 'after', 'around']
  method: ['create', 'update', 'patch', 'remove']
  multi: true
see:
  - utils/defineStash
  - utils/zipDataResult
  - predicates/isContext
  - predicates/shouldSkip
---

<!-- options -->

## Conditions

All conditions a subscription has must match. They may be async.

- Before the call: `iff` tests the call, e.g. with [`isContext`](/predicates/is-context) or [`isProvider`](/predicates/is-provider), and `data` tests `context.data` — on multi create every item on its own.
- After the call, for every item: `result` tests the item after the call, `before` the item before it, and `change` both of them, to compare them.

## Items Before and After the Call

The items come from [`defineStash`](/utils/define-stash):

- The items before the call are only fetched when needed: with `before`, with `change`, or with `fetchBefore`.
- Subscriptions whose fetches have equal params share them, across `trigger` hooks as well.
- `transformParams` adjusts the params of the fetches, e.g. to populate the items.

An action gets `{ id, before, result }` for every matching item. `batchAction` runs once, with all of them.

By default, the call waits for the actions and fails if one of them fails. With `isBlocking: false` it doesn't wait, and `trigger` logs the errors of the actions with `console.error` — nothing else would catch them.

## Skipping

A subscription with a `name` is skipped by `params.skipHooks`, just like a hook wrapped in [`skippable`](/hooks/skippable):

```ts
await app.service('posts').patch(id, data, { skipHooks: ['notifyOnPublish'] })
```

## Migrating from `feathers-trigger`

| `feathers-trigger`                                      | `feathers-utils`                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| `service: 'posts'`, `method: 'patch'`                   | `iff: isContext({ path: 'posts', method: 'patch' })`                  |
| `params: { provider: 'rest' }`                          | `iff: isProvider('rest')`                                             |
| `data: { … }`, `before: { … }`, `result: { … }`         | `data: (data) => …`, `before: (before) => …`, `result: (result) => …` |
| `result: ({ item, before }) => …`, a query or a boolean | `change: ({ before, result }) => boolean`                             |
| `manipulateParams`                                      | `transformParams`                                                     |
| `params.skipTrigger: 'name'`                            | `params.skipHooks: ['name']`                                          |
| `action({ before, item }, options)`                     | `action({ id, before, result }, options)`                             |
| `batchAction([[change, options], …], context)`          | `batchAction(items, { context, items, subscription })`                |

`feathers-trigger` matched query objects with [sift](https://github.com/crcn/sift.js). To keep a query, pass `sift(query)` — it returns a predicate.
