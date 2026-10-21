---
title: restrictQuery
category: hooks
tags:
  - query
  - authorization
options: RestrictQueryOptions
hook:
  type: ['before', 'around']
see:
  - utils/walkQuery
  - utils/dotifyQuery
  - predicates/isProvider
---

<!-- options -->

## What It Checks

- **The query**, including the branches of `$and`, `$or` and `$nor`: every field, and on a field with a list every operator. A plain value is equality, which a list always allows.
- **`$sort` and `$select`**: every field.
- **Nested queries** by their path: `{ address: { city: 'Köln' } }` is a query by `address.city`, which `address` allows.

Not checked: the id field of the service, which is always allowed, and other `$` filters like `$populate` - the adapter rejects the ones it doesn't know, unless they are whitelisted there. Internal calls, without a `provider`, are not restricted at all.
