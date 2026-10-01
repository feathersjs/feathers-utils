---
title: stashable
category: hooks
tags:
  - params
options: StashableOptions
hook:
  type: ["before", "around"]
  method: ["update", "patch", "remove"]
  multi: true
see:
  - utils/defineStash
---

::: warning Deprecated
Use [`defineStash`](/utils/define-stash) instead. `stashable` starts the fetch without waiting for it: if `get` or `find` have slow hooks, the call can overtake the fetch, and `stashed()` returns the items after the call. `defineStash` waits for the fetch and pairs the items before and after the call.
:::
