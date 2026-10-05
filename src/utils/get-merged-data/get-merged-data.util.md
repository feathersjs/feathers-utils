---
title: getMergedData
category: utils
tags:
  - data
  - multi
see:
  - utils/defineStash
  - hooks/trigger
  - utils/getDataIsArray
---

## Which Items Are Fetched

The fetch is a `find` through the service, with the params and query of the call, `paginate: false`, and the id of the call added to the query. Since it goes through the service, its hooks run as well, e.g. [`softDelete`](/hooks/soft-delete) leaves out deleted items.

The `$select` of the call is replaced by one of its own: the id field and the top-level properties of the requested fields, so `'address.city'` selects `address`. A fetch of the call that already has these fields is reused instead:

| Runs first | Runs after | Fetches |
| --- | --- | --- |
| `stash` or `trigger` (whole items) | `getMergedData` | 1 |
| `getMergedData(['a', 'b'])` | `getMergedData('a')` | 1 |
| `getMergedData('a')` | `getMergedData(['a', 'b'])` | 2 |
| `getMergedData` | `stash` or `trigger` | 2 |

An item that the query of the call excludes has no entry. A `patch` of it fails with `NotFound` anyway.

## Patch Data It Can't Merge

A key with a dot like `'address.city'` in patch data is a nested path for MongoDB, but a plain key for the other adapters, so its outcome depends on the adapter. If such a key overlaps a requested field (`'address.city'` overlaps `'address'`, `'address.city'` and `'address.city.zip'`), `getMergedData` throws instead of guessing. On other fields, such as `'address.zip'`, it is ignored.

Any other key is merged as a plain value, `$`-prefixed ones included: what an operator like `$inc` means is up to the adapter.
