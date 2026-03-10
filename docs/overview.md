# Overview

`feathers-utils` is a collection of common hooks, utilities, resolvers, transformers, predicates, and type guards for [FeathersJS](https://feathersjs.com/) applications. It is the official successor to `feathers-hooks-common`, redesigned for Feathers v5 with full TypeScript support, modular imports, and a cleaner API.

## Installation

::: code-group

```bash [npm]
npm install feathers-utils
```

```bash [pnpm]
pnpm add feathers-utils
```

```bash [yarn]
yarn add feathers-utils
```

:::

### Requirements

- **Node.js** 18 or later
- **FeathersJS** v5 (`@feathersjs/feathers ^5.0.0` as a peer dependency)

## Imports

`feathers-utils` provides modular sub-path exports so you can import only what you need:

```ts
// Import everything
import { transformData, isMulti } from 'feathers-utils'

// Import from specific categories
import { transformData, cache, softDelete } from 'feathers-utils/hooks'
import { getDataIsArray, iterateFind } from 'feathers-utils/utils'
import { resolveData, trim, omit } from 'feathers-utils/resolvers'
import { isMulti, isProvider } from 'feathers-utils/predicates'
import { pick, lowercase, setNow } from 'feathers-utils/transformers'
import { isObjectOrArray, isPaginated } from 'feathers-utils/guards'
```

## Categories

### [Hooks](/hooks/)

Reusable hooks for Feathers services. Includes hooks for caching, soft deletes, data transformation, conditional logic, and more. All hooks are compatible with Feathers v5 `around` hooks.

### [Utilities](/utils/)

Utility functions that can be used inside hooks or anywhere in your Feathers application. Helpers for working with context data, pagination, batching, and more.

### [Resolvers](/resolvers/)

Hooks that transform `context.data`, `context.result`, or `context.params.query` on a per-property basis. Resolvers run property functions in parallel and collect errors into a single `BadRequest`. Includes built-in helpers like `trim`, `omit`, `lowercase`, `setNow`, and `defaults`.

### [Predicates](/predicates/)

Functions that return a boolean based on the hook context. Use them with hooks like `iff` or `when` to conditionally run logic based on the request method, provider, or any custom condition.

### [Transformers](/transformers/)

Pure functions that modify data objects. Use them with `transformData`, `transformResult`, or `transformQuery` hooks to apply operations like `pick`, `omit`, `trim`, `lowercase`, `setNow`, `defaults`, and `parseDate`.

### [Type Guards](/guards/)

Runtime type checking functions that narrow types in TypeScript. Useful for safely handling paginated results, arrays, and other polymorphic values.

### [Utility Types](/utility-types/)

TypeScript type definitions that help with common patterns in Feathers applications.

## Coming from `feathers-hooks-common`?

If you are migrating from `feathers-hooks-common`, check out:

- [Why we moved](/why) - The motivation behind the new package.
- [Migration guide](/migrating-from-feathers-hooks-common) - A mapping from old hooks to their new equivalents.
