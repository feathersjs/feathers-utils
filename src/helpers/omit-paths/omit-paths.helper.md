---
title: omitPaths
category: helpers
see:
  - helpers/pickPaths
  - helpers/setPath
  - transformers/omit
---

## Coming from lodash

Given a nested path, `_.omit` deep-clones its whole input before deleting;
`omitPaths` copies only the objects on the omitted paths. The result is the
same, but untouched branches stay the same reference — cheaper, and safe for
values compared by identity (`params.connection`, an `ObjectId`). Unlike
`_.omit`, inherited enumerable properties are not copied into the result.

To omit fields of `context.data` or `context.result` inside a hook, prefer the
[`omit`](/transformers/omit) transformer.
