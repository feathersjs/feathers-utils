---
title: setPath
category: helpers
see:
  - helpers/getPath
  - helpers/omitPaths
  - hooks/setField
---

## Why copy-on-write

Feathers hands a hook the caller's `params`. The caller may reuse them for the
next call, so writing into `params.query` changes that call too. `setPath` only
ever writes into `target` itself and into fresh copies below it:

```ts
const params = { query: { active: true } }

await app.service('todos').find(params) // hook: setPath(context, 'params.query.userId', 1)

params.query // => { active: true } — untouched
```

## Coming from lodash

`_.set` writes into every object on the path. Replacing it with `setPath` keeps
the result the same but stops leaking the write into objects shared with the
caller. Two differences:

- objects on the path are shallow copies afterwards, so a reference taken
  before the call (`const q = context.params.query`) no longer points at what
  `context` holds;
- paths through `__proto__`, `constructor` or `prototype` are ignored instead
  of written.
