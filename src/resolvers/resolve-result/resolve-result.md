---
title: resolveResult
category: resolvers
hook:
  type: ["after", "around"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
helpers: true
---

## Resolver Helpers

<ResolversTable :filter="(r) => r.frontmatter.kind === 'helper'" />

## Conditions

<ConditionsTable />
