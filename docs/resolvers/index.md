---
---

# Resolvers

Resolvers are hooks that transform `context.data`, `context.result`, or `context.params.query` on a per-property basis. Each property resolver receives the current value, the full data object, the hook context, and resolver metadata. Resolvers run in parallel and errors are collected into a single `BadRequest`.

## Resolver Hooks

<ResolversTable :filter="(r) => !!r.hook" />

## Resolver Helpers

Resolver helpers are factory functions that return resolver property functions for common operations like omitting fields, trimming strings, or setting defaults.

<ResolversTable :filter="(r) => r.frontmatter.kind === 'helper'" />

## Conditions

Conditions control when a resolver helper is applied. They receive the full `ResolverPropertyOptions` object and return a boolean. When the condition returns `false`, the helper is skipped and the original value is preserved.

<ConditionsTable />
