# Migrating from @feathersjs/schema

This document provides a guide for migrating from `@feathersjs/schema` resolvers to the resolver hooks in `feathers-utils`. The new resolvers are lighter, faster, and don't require schema definitions.

`feathers-utils` is ESM only and does not support CommonJS. If you are using CommonJS, you need to migrate to ESM first.

## Why migrate?

`@feathersjs/schema` ties resolvers to TypeBox or JSON schema definitions, adds async overhead for every property, and ships a larger dependency footprint. The resolver hooks in `feathers-utils` are standalone functions that:

- Work without any schema library
- Are sync-first (only go async when a resolver actually returns a Promise)
- Ship built-in helpers like `omit()`, `defaults()`, `lowercase()`, `trim()`, and `setNow()`
- Support conditions via `fromPredicate()` for per-property logic

We recommend migrating gradually, one resolver at a time. Both packages can coexist in the same application.

## Resolver definition

In `@feathersjs/schema`, resolvers are created with `resolve()` which takes a property map and an optional options object, and returns a resolver instance with a `.resolve()` method:

```ts
// old (@feathersjs/schema)
import { resolve } from '@feathersjs/schema'
import type { HookContext } from './declarations'

const userResolver = resolve<User, HookContext>({
  name: async (value, user, context) => {
    return value?.toLowerCase()
  },
  fullName: virtual(async (user, context) => {
    return `${user.firstName} ${user.lastName}`
  }),
})

// standalone usage
const resolved = await userResolver.resolve(data, context)
```

In `feathers-utils`, resolver properties receive a single options object instead of positional arguments:

```ts
// new (feathers-utils)
import { resolveData } from 'feathers-utils/resolvers'

resolveData<Ctx>({
  name: ({ value }) => value?.toLowerCase(),
  fullName: ({ data }) => `${data.firstName} ${data.lastName}`,
})
```

### Key differences

| `@feathersjs/schema` | `feathers-utils` |
|---|---|
| `(value, data, context, status)` | `({ value, data, context, properties, i })` |
| `virtual(async (data, context) => ...)` | `({ data, context }) => ...` (no `virtual` needed) |
| `resolve<Type, Ctx>({...})` returns a resolver instance | `resolveData({...})` / `resolveResult({...})` returns a hook directly |
| Always async | Sync-first, only async when needed |
| Requires schema definition | Works standalone |

## `virtual`

The `virtual()` wrapper from `@feathersjs/schema` is no longer needed. In `feathers-utils`, every resolver property receives the full `{ value, data, context }` options, so you can simply ignore `value` and compute from `data`:

```ts
// old
import { virtual } from '@feathersjs/schema'

const userResolver = resolve<User, HookContext>({
  fullName: virtual(async (user, context) => {
    return `${user.firstName} ${user.lastName}`
  }),
})

// new
resolveResult<Ctx>({
  fullName: ({ data }) => `${data.firstName} ${data.lastName}`,
})
```

## `converter`

The `converter` option from `@feathersjs/schema` (a function that runs before property resolvers) has no direct equivalent. Use a `transformData` or `transformResult` hook before the resolver hook instead:

```ts
// old
const userResolver = resolve<User, HookContext>({
  properties: { ... },
}, {
  converter: async (data) => {
    return someTransformation(data)
  },
})

// new
import { transformData } from 'feathers-utils/hooks'

app.service('users').hooks({
  before: {
    create: [
      transformData((item) => someTransformation(item)),
      resolveData({ /* ... */ }),
    ],
  },
})
```

## Hook migration

### `resolveData`

In `@feathersjs/schema`, `resolveData` accepts multiple resolver instances that run sequentially:

```ts
// old
import { resolveData } from '@feathersjs/schema'

app.service('users').hooks({
  before: {
    create: [resolveData(createUserDataResolver)],
    patch: [resolveData(patchUserDataResolver)],
  },
})
```

In `feathers-utils`, `resolveData` takes a resolver object directly:

```ts
// new
import { resolveData, lowercase, setNow, defaults } from 'feathers-utils/resolvers'

app.service('users').hooks({
  before: {
    create: [
      resolveData({
        email: lowercase(),
        role: defaults('user'),
        createdAt: setNow(),
      }),
    ],
  },
})
```

If you had multiple resolvers running sequentially, use multiple hooks:

```ts
// old
resolveData(firstResolver, secondResolver)

// new
app.service('users').hooks({
  before: {
    create: [
      resolveData({ /* first */ }),
      resolveData({ /* second */ }),
    ],
  },
})
```

### `resolveResult`

In `@feathersjs/schema`, `resolveResult` **must** be an `around` hook for proper `$select` handling:

```ts
// old
import { resolveResult } from '@feathersjs/schema'

app.service('users').hooks({
  around: {
    all: [resolveResult(resultResolver)],
  },
})
```

In `feathers-utils`, `resolveResult` works as `after` or `around`:

```ts
// new
import { resolveResult, omit } from 'feathers-utils/resolvers'

app.service('users').hooks({
  after: {
    all: [
      resolveResult({
        password: omit(),
        fullName: ({ data }) => `${data.firstName} ${data.lastName}`,
      }),
    ],
  },
})
```

### `resolveQuery`

```ts
// old
import { resolveQuery } from '@feathersjs/schema'

app.service('users').hooks({
  before: {
    all: [resolveQuery(queryResolver)],
  },
})

// new
import { resolveQuery, defaults } from 'feathers-utils/resolvers'

app.service('users').hooks({
  before: {
    find: [
      resolveQuery({
        active: defaults(true),
        userId: ({ context }) => context.params.user?.id,
      }),
    ],
  },
})
```

### `resolveExternal` / `resolveDispatch`

`@feathersjs/schema` has `resolveExternal` (also called `resolveDispatch`) to return safe data for external clients. In `feathers-utils`, use `resolveResult` with the [`omit()` helper](/resolvers/omit.html) instead:

```ts
// old
import { resolveExternal } from '@feathersjs/schema'

const externalResolver = resolve<User, HookContext>({
  password: async () => undefined,
})

app.service('users').hooks({
  around: {
    all: [resolveExternal(externalResolver)],
  },
})

// new
import { resolveResult, omit } from 'feathers-utils/resolvers'

app.service('users').hooks({
  after: {
    all: [resolveResult({ password: omit() })],
  },
})
```

If you need to strip fields only for external requests, use `fromPredicate`:

```ts
import { resolveResult, omit, fromPredicate } from 'feathers-utils/resolvers'
import { isProvider } from 'feathers-utils/predicates'

app.service('users').hooks({
  after: {
    all: [
      resolveResult({
        password: omit(),
        internalField: omit(fromPredicate(isProvider('external'))),
      }),
    ],
  },
})
```

### `resolveAll`

`@feathersjs/schema` provides `resolveAll` to combine data, query, result, and dispatch resolvers in one call. In `feathers-utils`, use the combined [`resolve`](/resolvers/resolve.html) hook:

```ts
// old
import { resolveAll } from '@feathersjs/schema'

app.service('users').hooks({
  around: {
    all: [
      resolveAll({
        data: { create: createResolver, update: updateResolver, patch: patchResolver },
        query: queryResolver,
        result: resultResolver,
        dispatch: dispatchResolver,
      }),
    ],
  },
})

// new
import { resolve, omit, defaults, lowercase } from 'feathers-utils/resolvers'

app.service('users').hooks({
  around: {
    all: [
      resolve({
        data: { email: lowercase(), role: defaults('user') },
        query: { active: defaults(true) },
        result: { password: omit() },
      }),
    ],
  },
})
```

Note that `feathers-utils` does not have a separate `dispatch` resolver. Use `resolveResult` or `transformResult` with the `dispatch` option on `transformResult` if you need to transform `context.dispatch` separately.

## Resolver helpers

`feathers-utils` ships built-in helpers that replace common resolver patterns:

| Common pattern | `feathers-utils` helper |
|---|---|
| `async () => undefined` | [`omit()`](/resolvers/omit.html) |
| `async (value) => value?.trim()` | [`trim()`](/resolvers/trim.html) |
| `async (value) => value?.toLowerCase()` | [`lowercase()`](/resolvers/lowercase.html) |
| `async () => Date.now()` | [`setNow()`](/resolvers/set-now.html) |
| `async (value) => value ?? defaultValue` | [`defaults(defaultValue)`](/resolvers/defaults.html) |

All helpers accept an optional [condition](/resolvers/from-predicate.html) to conditionally apply the transformation.

## Conditions with `fromPredicate`

`@feathersjs/schema` doesn't have a built-in condition system. Conditional logic had to be written inline:

```ts
// old
const userResolver = resolve<User, HookContext>({
  password: async (value, user, context) => {
    if (context.params.provider) {
      return undefined
    }
    return value
  },
})

// new
import { resolveResult, omit, fromPredicate } from 'feathers-utils/resolvers'
import { isProvider } from 'feathers-utils/predicates'

resolveResult({
  password: omit(fromPredicate(isProvider('external'))),
})
```

## Performance considerations

`@feathersjs/schema` resolvers are always async. Every property resolver awaits, even for synchronous operations. In `feathers-utils`, resolvers are sync-first: if all property resolvers return synchronous values, the entire resolve call completes synchronously with zero Promise overhead.

Keep resolver properties synchronous where possible for best performance. If you need to do async work (e.g. database lookups), only those specific properties will be awaited.
