---
title: counterCache
category: hooks
tags:
  - data
  - multi
  - relations
options: CounterCacheOptions
hook:
  type: ['before', 'after', 'around']
  method: ['create', 'update', 'patch', 'remove']
  multi: true
see:
  - utils/count
  - hooks/onDelete
  - hooks/createRelated
---

<!-- options -->

## Counting Again Instead of Incrementing

After the call, `counterCache` counts the items of every parent the call touched - before and after it, so a `patch` that moves an item updates both parents. That is one `count` per parent and one write per group of parents with an equal count, instead of an `$inc`:

- it works with every adapter, `$inc` is not portable,
- the count can't drift, e.g. after a failed write or an item removed by other means,
- and `where` can narrow what counts.

The count goes through the hooks of `find` of this service, as an internal call - so a `softDelete` hook narrows it as well.

## What It Fetches

Before an `update`, `patch` or `remove`, the id and the key of the items, once per call and [shared](/utils/get-merged-data) with `stash` and `trigger`. After the call, the key comes from the result - only if the `$select` of the call leaves it out, the items are fetched again.
