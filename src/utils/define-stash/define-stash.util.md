---
title: defineStash
category: utils
tags:
  - result
  - params
  - multi
options: StashOptions
see:
  - hooks/stashable
---

`defineStash` returns a pair: `stash` fetches the items of a call before it runs, `stashed` returns them — paired with the items after the call, once it ran. It replaces [`stashable`](/hooks/stashable).

```ts
import { defineStash } from 'feathers-utils/utils'

const { stash, stashed } = defineStash<User>()

app.service('users').hooks({
  before: { patch: [stash] },
  after: {
    patch: [
      async (context) => {
        for (const { before, result } of await stashed(context)) {
          if (before?.email !== result?.email) await sendMail(result)
        }
      },
    ],
  },
})
```

Without options, `stash` and `stashed` can be imported directly:

```ts
import { stash, stashed } from 'feathers-utils/utils'
```

<!-- options -->

## `stash`

- Use it as a `before` or `around` hook, or call it from one before `next()`: `await stash(context, next)`.
- Works on `create`, `update`, `patch` and `remove`. On `create` there is nothing to fetch, `before` stays `undefined`.
- Fetches with `find`, a call with an `id` by its id, so the items before and after the call go through the same hooks.
- Waits for the fetch, so the call can't overtake it. If the fetch fails, the call fails.
- Throws after the call ran, e.g. in an around hook after `next()`.
- Calling the same `stash` again in one call does nothing.

## `stashed`

Returns an array of `{ id, before, result }`, with one entry for a call with an `id`:

```ts
const [{ before }] = await stashed(context)
```

- Before the call ran, only `before` is set — e.g. to validate a patch against the stored item.
- After the call, the items of `context.result` are paired with the items before by id, in the order of the result. On `remove`, `result` is the removed item.
- With `transformParams` or `$select`, the items after the call are refetched by id, with the params of the call. Otherwise `context.result` is used as it is.
- Throws if `stash` didn't run for this call.

## Several Stashes in One Call

Every `defineStash()` is its own stash, e.g. one per subscription with its own `transformParams`. Stashes of one call that fetch with equal params share the fetch, before and after the call.

Params are compared so that different params are never taken for equal: plain objects and arrays by content, dates and regular expressions by value, everything else — functions, class instances like a CASL ability or a tracing span — by reference. Within one call those are the same references, so they don't prevent sharing.

## Per Call, Not on `params`

A stash belongs to the call, not to `params`. Nothing is written to `params`: concurrent calls with one `params` object and nested calls with `{ ...context.params }` don't see each other's stash.

The fetches get a copy of the params, so their hooks can't write into the params of the call either — [feathers-casl](https://github.com/feathersjs-ecosystem/feathers-casl), for one, keeps its state of the call on `params.casl`.

## Migrating from `stashable`

```ts
// before
import { stashable } from 'feathers-utils/hooks'

app.service('users').hooks({
  before: { patch: [stashable()] },
})
const before = await context.params.stashed()

// after
import { stash, stashed } from 'feathers-utils/utils'

app.service('users').hooks({
  before: { patch: [stash] },
})
const [{ before }] = await stashed(context)
```

| `stashable`                              | `defineStash`                                            |
| ---------------------------------------- | -------------------------------------------------------- |
| `context.params.stashed()`               | `stashed(context)`                                       |
| `propName` option                        | not needed, every `defineStash()` is its own stash       |
| `stashFunc` option                       | `transformParams` adjusts the params of the fetch        |
| `get` for a call with an `id`            | always `find`, a call with an `id` by its id             |
| multi: the array of `find`               | an array of `{ id, before, result }`                     |
| starts the fetch without waiting for it  | waits for the fetch, so the call can't overtake it       |
| a failing fetch returns `undefined`      | a failing fetch fails the call                           |
