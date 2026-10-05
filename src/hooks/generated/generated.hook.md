---
title: generated
category: hooks
tags:
  - data
  - multi
options: GeneratedOptions
hook:
  type: ['before', 'after', 'around']
  method: ['create', 'update', 'patch']
  multi: true
see:
  - utils/getMergedData
  - hooks/trigger
  - hooks/preventChanges
---

<!-- options -->

## When the Fields Are Computed

| Call                                       | Computed from                              | Fetch                                       |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------- |
| `create`, `update`                         | `data`                                     | none                                        |
| `patch` that changes no `from` field       | not computed, the stored fields stay as they are | none                                  |
| `patch` whose `data` has all `from` fields | `data`, once for all items                 | none                                        |
| any other `patch`                          | `data` merged over the stored items        | one, [shared](/utils/get-merged-data) with `stash` and `trigger` |

If the stored items were fetched and no item's `from` fields change, e.g. because a form sends all fields, `generate` is not called and the stored generated fields stay. Once one item changes, all items of the call are computed, so that equal values can still share a write. Values are compared by content - a bson `ObjectId` as well; a class that keeps its value in `#private` fields would look unchanged.

`generate` gets only the `from` fields of each item. A field it needs must be in `from`, also so that a `patch` of it recomputes the generated fields.

## Multi Patch With Values per Item

A multi patch has a single `data` for all items, but the generated fields may differ per item:

```ts
// Anna Meier and Ben Schmidt: 'X Meier' and 'X Schmidt'
users.patch(null, { firstName: 'X' }, { query: { familyId: 7 } })
```

Then the call writes `data` as usual, without the generated fields. After it, `generated` writes them with the `_patch` of the adapter, without hooks, and puts the items into `context.result`. Items with equal values share a write, grouped by [`patchBatch`](/utils/patch-batch): in the example, all items named Meier get one `_patch(null, …)` with `{ id: { $in: [...] } }`. The `patched` events are sent after all hooks, so they carry the final items.

- It costs one write per group of equal values. The writes get the params of the call without its query, so a transaction passed in `params` covers them as well. Without one, it is not atomic: until the writes are done, the items hold the old generated fields.
- It needs the `_patch` method of a database adapter. Without one, `generated` throws before anything is written.

If the values are equal for every item, they go into `data` and the call writes them itself.

## Registering It

As an `around` hook, or as a `before` and an `after` hook:

- Before the call, `generated` computes from `data`, so put it after the hooks that validate or resolve `data`.
- After the call, it only does something when a multi patch needs the writes above. Hooks that see the result after it, such as a resolver of the result or of `context.dispatch`, get the final items: around hooks registered before it, or after hooks registered after it. Regular after hooks inside an around `generated` still see the result of the multi patch alone.
