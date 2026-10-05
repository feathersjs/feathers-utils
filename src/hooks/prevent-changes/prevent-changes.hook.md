---
title: preventChanges
category: hooks
tags:
  - data
  - validation
options: PreventChangesOptions
hook:
  type: ["before", "around"]
  method: ["update", "patch"]
  multi: true
see:
  - utils/getMergedData
  - hooks/check
---

<!-- options -->

## Compared With the Stored Items

An `update` always compares, and a `patch` with `compare`: a field only counts as a change if its value differs from the stored one. The stored items are fetched once per call, with only the protected fields unless `select: false`.

- A top-level field that changes is dropped from `data`, so the item keeps its stored value.
- A nested field that changes, like `role.type`, gets its stored value back in `data`, since `role` replaces the stored one as a whole. If a multi patch would need a different value per item, the whole `role` is dropped instead.
- A key with a dot like `'role.type'` in patch data is a path for some adapters only, so it always counts as a change.
