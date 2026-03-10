# Migrating from feathers-fletching

This document provides a guide for migrating from `feathers-fletching` to `feathers-utils`. The `feathers-utils` `cache` hook is heavily inspired by `feathers-fletching`'s `contextCache`, and many of the `with*`/`without*` hooks have direct equivalents.

`feathers-utils` is ESM only and does not support CommonJS. If you are using CommonJS, you need to migrate to ESM first.

We recommend migrating gradually, one hook at a time. Both packages can coexist in the same application.

## `withResult`

`withResult` adds or overwrites properties on `context.result`. In `feathers-utils`, this maps to either [`resolveResult`](/resolvers/resolve-result.html) (for per-property resolvers) or [`transformResult`](/hooks/transform-result.html) (for general transformations).

### Simple property mapping

```ts
// old (feathers-fletching)
import { withResult } from "feathers-fletching";

withResult({
  status: "platinum",
  summary: (result, context) => result.description.substring(0, 3) + "...",
  artist: (result, context) =>
    context.app.service("artists").get(result.artist_id),
  secret: () => undefined, // removes the property
});

// new (feathers-utils) — using resolveResult
import { resolveResult, omit } from "feathers-utils/resolvers";

resolveResult({
  status: () => "platinum",
  summary: ({ data }) => data.description.substring(0, 3) + "...",
  artist: ({ data, context }) =>
    context.app.service("artists").get(data.artist_id),
  secret: omit(),
});
```

### Key differences

| `feathers-fletching`                         | `feathers-utils`                                         |
| -------------------------------------------- | -------------------------------------------------------- |
| `(result, context, prepResult)`              | `({ value, data, context, properties, i })`              |
| `prepFunc` second argument for batch loaders | Use a custom hook or prepare loaders before the resolver |
| `@` prefix for sequential execution          | Not supported — all properties run in parallel if async  |
| Returning `undefined` deletes the key        | Same behavior — returning `undefined` omits the key      |

### With `prepFunc` (batch loaders)

`feathers-fletching` allows a `prepFunc` to set up batch loaders. In `feathers-utils`, prepare loaders in a preceding hook and attach them to `context.params`:

```ts
// old
withResult(
  {
    artist: (result, context, loaders) => loaders.artists.load(result.artist_id),
  },
  async (context) => ({
    artists: new BatchLoader('artists'),
  })
)

// new
const setupLoaders = (context) => {
  context.params.loaders = {
    artists: new BatchLoader('artists'),
  }
  return context
}

resolveResult({
  artist: ({ data, context }) => context.params.loaders.artists.load(data.artist_id),
})

// register both
app.service('albums').hooks({
  after: {
    all: [setupLoaders, resolveResult({ artist: /* ... */ })],
  },
})
```

### Alternative: `transformResult`

For simpler transformations where you don't need per-property resolvers:

```ts
import { transformResult } from "feathers-utils/hooks";

app.service("albums").hooks({
  after: {
    all: [
      transformResult((item, { context }) => {
        item.summary = item.description.substring(0, 3) + "...";
        return item;
      }),
    ],
  },
});
```

## `withoutResult`

`withoutResult` removes properties from `context.result`. In `feathers-utils`, use [`resolveResult`](/resolvers/resolve-result.html) with the [`omit()`](/resolvers/omit.html) helper, or [`transformResult`](/hooks/transform-result.html) with the [`omit` transformer](/transformers/omit.html).

### Always remove fields

```ts
// old
import { withoutResult } from "feathers-fletching";

withoutResult(["password", "ssn"]);
// or
withoutResult({ password: false, ssn: false });

// new — using resolveResult
import { resolveResult, omit } from "feathers-utils/resolvers";

resolveResult({
  password: omit(),
  ssn: omit(),
});

// new — using transformResult (alternative)
import { transformResult } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

transformResult((item) => omit(item, ["password", "ssn"]));
```

### Conditionally remove fields

```ts
// old
withoutResult({
  email: (result, context) => context.params.user.role === "admin", // keep if admin
});

// new
import { resolveResult, omit, fromPredicate } from "feathers-utils/resolvers";

resolveResult({
  email: omit(
    fromPredicate(({ context }) => context.params.user.role !== "admin"),
  ),
});
```

Note the logic is inverted: `feathers-fletching` returns truthy to **keep**, while `omit()` with a condition removes when the condition is **true**.

## `withData`

`withData` adds or overwrites properties on `context.data`. In `feathers-utils`, use [`resolveData`](/resolvers/resolve-data.html) or [`transformData`](/hooks/transform-data.html).

```ts
// old
import { withData } from "feathers-fletching";

withData({
  user_id: (data, context) => context.params.user.id,
  email: (data, context) => data.email.trim().toLowerCase(),
});

// new — using resolveData
import { resolveData, lowercase, trim } from "feathers-utils/resolvers";

resolveData({
  user_id: ({ context }) => context.params.user.id,
  email: ({ value }) => value?.trim().toLowerCase(),
  // or compose helpers:
  // email: trim(), // if you only need trim
});

// new — using transformData (alternative)
import { transformData } from "feathers-utils/hooks";

transformData((item, { context }) => {
  item.user_id = context.params.user.id;
  item.email = item.email.trim().toLowerCase();
  return item;
});
```

## `withoutData`

`withoutData` removes properties from `context.data`. In `feathers-utils`, use [`resolveData`](/resolvers/resolve-data.html) with [`omit()`](/resolvers/omit.html), or [`transformData`](/hooks/transform-data.html) with the [`omit` transformer](/transformers/omit.html).

```ts
// old
import { withoutData } from "feathers-fletching";

withoutData(["ssn", "role"]);
// or
withoutData({
  ssn: false,
  role: (data, context) => context.params.user.role === "admin", // keep if admin
});

// new — using resolveData
import { resolveData, omit, fromPredicate } from "feathers-utils/resolvers";

resolveData({
  ssn: omit(),
  role: omit(
    fromPredicate(({ context }) => context.params.user.role !== "admin"),
  ),
});

// new — always remove with transformData
import { transformData } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

transformData((item) => omit(item, ["ssn", "role"]));
```

## `withQuery`

`withQuery` adds or overwrites properties on `context.params.query`. In `feathers-utils`, use [`resolveQuery`](/resolvers/resolve-query.html) or [`transformQuery`](/hooks/transform-query.html).

```ts
// old
import { withQuery } from "feathers-fletching";

withQuery({
  user_id: (data, context) => context.params.user.id,
  active: () => true,
});

// new — using resolveQuery
import { resolveQuery, defaults } from "feathers-utils/resolvers";

resolveQuery({
  user_id: ({ context }) => context.params.user.id,
  active: defaults(true),
});

// new — using transformQuery (alternative)
import { transformQuery } from "feathers-utils/hooks";

transformQuery((query, { context }) => {
  query.user_id = context.params.user.id;
  query.active = true;
  return query;
});
```

## `withoutQuery`

`withoutQuery` removes properties from `context.params.query`. In `feathers-utils`, use [`resolveQuery`](/resolvers/resolve-query.html) with [`omit()`](/resolvers/omit.html), or [`transformQuery`](/hooks/transform-query.html) with the [`omit` transformer](/transformers/omit.html).

```ts
// old
import { withoutQuery } from "feathers-fletching";

withoutQuery(["ssn", "secret"]);

// new — using resolveQuery
import { resolveQuery, omit } from "feathers-utils/resolvers";

resolveQuery({
  ssn: omit(),
  secret: omit(),
});

// new — using transformQuery
import { transformQuery } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

transformQuery((query) => omit(query, ["ssn", "secret"]));
```

## `contextCache`

The [`cache`](/hooks/cache.html) hook in `feathers-utils` is heavily inspired by `feathers-fletching`'s `contextCache`. The main difference is that you bring your own cache implementation (any object with `get`, `set`, `delete`, `clear`, and `keys` methods).

```ts
// old
import { contextCache, ContextCacheMap } from "feathers-fletching";

const cacheMap = new ContextCacheMap({ max: 100 });
const cache = contextCache(cacheMap);

// new
import { cache } from "feathers-utils/hooks";

const cached = cache({
  map: new Map(), // or any Map-like implementation (lru-cache, etc.)
});

app.service("albums").hooks({
  around: {
    all: [cached],
  },
});
```

## `skippable`

In `feathers-fletching`, `skippable` wraps a hook with a name and checks `params.skipHooks`. In `feathers-utils`, [`skippable`](/hooks/skippable.html) wraps a hook with a predicate function, and works together with [`shouldSkip`](/predicates/should-skip.html) and [`addSkip`](/utils/add-skip.html).

```ts
// old
import { skippable } from "feathers-fletching";

const myHook = skippable("myHook", (context) => {
  // hook logic
  return context;
});

// skip it
app.service("albums").find({ skipHooks: ["myHook"] });

// new
import { skippable } from "feathers-utils/hooks";
import { shouldSkip } from "feathers-utils/predicates";

const myHook = skippable((context) => {
  // hook logic
  return context;
}, shouldSkip("myHook"));

// skip it
import { addSkip } from "feathers-utils/utils";

app.service("albums").find(addSkip({}, "myHook"));
```

## `stashable`

In `feathers-fletching`, `stashable` lazily stashes the pre-mutation state of a record. In `feathers-utils`, [`stashable`](/hooks/stashable.html) eagerly starts the fetch but exposes a memoized function — calling it multiple times only hits the database once.

```ts
// old
import { stashable } from "feathers-fletching";

app.service("users").hooks({
  before: {
    patch: [stashable()],
  },
});

// Access in a later hook:
const before = await context.params.stashed();

// new
import { stashable } from "feathers-utils/hooks";

app.service("users").hooks({
  before: {
    patch: [stashable()],
  },
});

// Access in a later hook (before or after):
const before = await context.params.stashed();
```

### Key differences

| `feathers-fletching`                       | `feathers-utils`                                                     |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Lazy — only fetches when `stashed()` is called | Eager start — fetch begins immediately, result is memoized        |
| `propName` option (default: `'stashed'`)   | Same — `propName` option (default: `'stashed'`)                      |
| `stashFunc` option for custom fetch        | Same — `stashFunc` option for custom fetch                           |

## `joinQuery`

There is no direct equivalent for `joinQuery` in `feathers-utils`. For relational-style cross-service queries, consider using:

- The underlying database adapter directly (e.g., knex joins, MongoDB aggregation)
- The [`onDelete`](/hooks/on-delete.html) hook for cascading deletes and nullification of foreign keys
- Custom hooks with [`transformQuery`](/hooks/transform-query.html) for query rewriting

If you need `joinQuery` functionality, please reach out in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).
