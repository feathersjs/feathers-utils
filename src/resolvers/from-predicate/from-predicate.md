---
title: fromPredicate
category: resolvers
kind: helper
see:
  - predicates
  - resolvers/resolveData
  - resolvers/resolveResult
  - resolvers/resolveQuery
---

## Usage with Resolver Helpers

`fromPredicate` bridges existing predicates (like `isProvider`, `isContext`, `not`) into resolver conditions. Predicates receive the hook context, while resolver conditions receive the full `ResolverPropertyOptions`. This adapter extracts the context and passes it to the predicate.

```ts
import { resolveResult, omit, fromPredicate } from "feathers-utils/resolvers";
import { isProvider } from "feathers-utils/predicates";

resolveResult({
  password: omit(fromPredicate(isProvider("external"))),
});
```

::: warning
`fromPredicate` only supports synchronous predicates. If the predicate returns a `Promise`, it will throw an error at runtime.
:::
