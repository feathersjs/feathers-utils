---
title: resolve
category: resolvers
hook:
  type: ["around"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
helpers: true
---

`resolve` is a combined around hook that resolves `data`, `query`, and `result` in a single call. Data and query resolvers run before `next()`, result resolvers run after. At least one resolver category must be provided.

## Resolver Helpers

<ResolversTable :filter="(r) => r.frontmatter.kind === 'helper'" />

## Conditions

<ConditionsTable />
