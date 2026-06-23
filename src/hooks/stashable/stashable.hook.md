---
title: stashable
category: hooks
hook:
  type: ["before", "after", "around"]
  method: ["create", "update", "patch", "remove"]
  multi: true
---

The `stashable` hook stashes all affected records by their id for a `create`, `update`, `patch` or `remove` call and (optionally) passes them to a callback. For every affected id it provides the state `before` the mutation and the resulting `item` after it.

It runs in `before` + `after` (or a single `around`) and stores the result at `context.params[name]` (default `stash`) as a `Record<Id, { before, item }>`.

## Example

```ts
// users.hooks.ts
import { stashable } from "feathers-utils/hooks";

export default {
  around: {
    all: [
      stashable(
        (stash, context) => {
          for (const id in stash) {
            const { before, item } = stash[id];
            // react to the change
          }
        },
        { fetchBefore: true },
      ),
    ],
  },
};
```

The callback is optional — without it, the result is still available on `context.params.stash`:

```ts
const { before, item } = context.params.stash[id];
```

## Options

| Property       | Description                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchBefore`  | Whether to fetch the items before the mutation (for `update`, `patch`, `remove`). Disabled by default for performance.<br>**Type:** `boolean` - _Default:_ `false`         |
| `params`       | Manipulate the params used for (re)fetching the items if needed.<br>**Type:** `(params: Params, context: HookContext) => Promisable<Params \| null>` - _Default:_ `undefined` |
| `skipHooks`    | Use `_find`/`_get` instead of `find`/`get` for (re)fetching, bypassing the service hooks.<br>**Type:** `boolean` - _Default:_ `false`                                      |
| `deleteParams` | Keys to delete from the params before (re)fetching.<br>**Type:** `string[]` - _Default:_ `[]`                                                                             |
| `name`         | The property on `context.params` to store the stash at.<br>**Type:** `string \| string[]` - _Default:_ `"stash"`                                                          |

## `stash` util

`stashable` is built on top of the `stash` util. Use it to stash imperatively inside your own hooks — it is phase-aware and writes to `context.params.stash`:

```ts
import { stash } from "feathers-utils";

// in a before hook
await stash(context, { fetchBefore: true });

// in an after hook
const changes = await stash(context, { fetchBefore: true });
```
