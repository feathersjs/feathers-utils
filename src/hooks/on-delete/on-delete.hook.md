---
title: onDelete
category: hooks
tags:
  - relations
options: OnDeleteOptions
hook:
  type: ["before", "after", "around"]
  method: ["remove"]
  multi: true
see:
  - utils/patchMany
  - utils/removeMany
  - utils/defineStash
---

## Before and after

Register one `onDelete()` in `before` and `after`, or as `around`:

- Before the removal, it fetches the items with [`stash`](/utils/define-stash), through the `find` hooks.
- After it, it changes the related items of the items the call removed, by their keys before the removal: a `$select` of the call or a trimmed result don't hide `keyHere`. A removal that fails changes nothing.
- Only in `after`, it takes the keys from `context.result`. Only in `before`, it does nothing.

A foreign key that the database cascades or sets null itself (`ON DELETE CASCADE`) has changed the related items before the `after` part runs - without service events or hooks. To change them through their service instead, let the database check the key at the end of the transaction (`DEFERRABLE INITIALLY DEFERRED`) and change them in it with `blocking` and `params`:

```ts
import { onDelete } from 'feathers-utils/hooks'

const removePosts = onDelete({
  service: 'posts',
  keyHere: 'id',
  keyThere: 'userId',
  onDelete: 'cascade',
  blocking: true,
  params: (context) => ({ transaction: context.params.transaction }),
})

app.service('users').hooks({
  before: { remove: [removePosts] },
  after: { remove: [removePosts] },
})
```
