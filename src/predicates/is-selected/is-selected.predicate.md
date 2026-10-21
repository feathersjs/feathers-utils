---
title: isSelected
category: predicates
tags:
  - query
  - result
see:
  - hooks/iff
  - resolvers/fromPredicate
---

## In Resolvers

A resolver gets the context, so the predicate works there as well, e.g. to compute a virtual field only for results that have the fields it is computed from:

```ts
import { resolveResult } from 'feathers-utils/resolvers'
import { isSelected } from 'feathers-utils/predicates'

const hasNames = isSelected(['firstName', 'lastName'])

resolveResult({
  fullName: ({ data, context }) =>
    hasNames(context) ? `${data.firstName} ${data.lastName}` : undefined,
})
```

It is synchronous, so [`fromPredicate`](/resolvers/from-predicate) also turns it into a condition for helpers like `omit`.
