# Migrating from feathers-hooks-common

This document provides a guide for migrating from `feathers-hooks-common` to `feathers-utils`. The changes include the removal of certain hooks, the introduction of new hooks, and modifications to existing utilities and predicates.

'feathers-utils' is esm only and does not support CommonJS. If you are using CommonJS, you need to migrate to esm first.

The migration from 'feathers-hooks-common' to 'feathers-utils' is not a 1:1 mapping. Some hooks have been removed, some have been replaced with new hooks, and some utilities have been added or modified. This document will help you understand the changes and how to adapt your code accordingly. We recommend to migrate gradually hook by hook and utility by utility.

In the following sections, we will cover the changes in detail. You can browse this migration guide and search for the hooks and utilities from 'feathers-hooks-common' you are using in your codebase. If you have any questions or need help with the migration, please reach out in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `actOn`, `actOnDefault`, and `actOnDispatch`

The `actOn`, `actOnDefault`, and `actOnDispatch` hooks have been removed. But we can add it back if needed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `alterItems`

The hook `alterItems` was removed and replaced with the more explicit [`transformData`](/hooks/transform-data.html) and [`transformResult`](/hooks/transform-result.html) hooks. These hooks allow you to transform the data or result of a hook call, respectively.

The signature of the new hooks differ a little bit. The second argument of the transformer function is now an `options` object instead of the `context`.

```ts
// old
import { alterItems } from "feathers-hooks-common";

alterItems((item, context) => {
  // transform item
  return item;
});

// new
import { transformData } from "feathers-utils/hooks";

transformData((item, { context }) => {
  // transform item
  return item;
});
```

In [`transformResult`](/hooks/transform-result.html) you have a third argument of type `MutateResultOptions` in which you set the `{ dispatch: true }` (transform items in `context.dispatch`) or `{ dispatch: 'both' }` option (transform items in `context.result` and `context.dispatch`).

## `cache`

The `cache` hook is completely rewritten. Its implementation is heavily inspired by [`contextCache` from 'feathers-fletching'](https://daddywarbucks.github.io/feathers-fletching/#/./hooks?id=contextcache) but has a few differences.

The old `cache` hook only worked for `get` requests and did not work with varying `params` in a way that it's hardly imaginable that the old `cache` hook was used by somebody. The new `cache` hook is decoupled from '@feathers-plus/cache' and you need to bring your own cache implementation.

The new `cache` hook caches `get` and `find` requests and considers the `params` object when caching. This means that if you call the same `get` or `find` request with different `params`, it will cache each unique request separately.

## `callingParams`

The `callingParams` utility was removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `checkContextIf`

The `checkContextIf` utility was removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `dePopulate`

The `dePopulate` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

Nowadays it's recommended to use [resolvers](https://feathersjs.com/api/schema/resolvers.html), or [feathers-graph-populate](https://feathers-graph-populate.netlify.app/getting-started.html) or to use the underlying adapter (like `mongo` or `knex`) directly to populate data.

## `disallow`

The `disallow` hook has been updated to use a more explicit syntax. Instead of using a spread argument, you can now pass a single string or an array of field names to specify which fields should not be allowed in the data or result of a hook call. This change improves clarity and consistency in how disallowed fields are specified.

```ts
// old
import { disallow } from "feathers-hooks-common";

app.service("my-service").hooks({
  before: {
    all: [disallow("field1", "field2")],
  },
});

// new
import { disallow } from "feathers-utils/hooks";

app.service("my-service").hooks({
  before: {
    all: [disallow(["field1", "field2"])],
  },
});
```

## `discard`

The `discard` hook has been removed. Instead you can use [`transformData`](/hooks/transform-data.html) or [`transformResult`](/hooks/transform-result.html) with the [`omit transformer`](/transformers/omit.html).

The old `discard` hook used spread arguments to specify fields to discard, which has been removed in favor of the new [`omit` transformer](/transformers/omit.html) that requires a single string or an array of field names.

```ts
import { transformData, transformResult } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    all: [transformData(omit(["field1", "field2"]))],
  },
  after: {
    all: [transformResult(omit(["field1", "field2"]))],
  },
});
```

## `discardQuery`

The `discardQuery` hook has been removed. Instead you can use `transformQuery` with the `omit` transformer.

The old `discardQuery` hook used spread arguments to specify fields to discard, which has been removed in favor of the new [`omit` transformer](/transformers/omit.html) that requires a single string or an array of field names.

```ts
import { transformQuery } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    all: [transformQuery(omit(["field1", "field2"]))],
  },
});
```

## `fastJoin`

The `fastJoin` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

Nowadays it's recommended to use [resolvers](https://feathersjs.com/api/schema/resolvers.html), or [feathers-graph-populate](https://feathers-graph-populate.netlify.app/getting-started.html) or to use the underlying adapter (like `mongo` or `knex`) directly to populate data.

## `fgraphql`

The `fgraphql` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `getItems`

The `getItems` utility has been removed. It had too much magic. Based on `context.type` it returned `context.data` or `context.result`. This does not play well with `around` hooks or for example when you early return `context.result` in a `before` hook and want to get `context.result` in a `before` hook. Also it returned an object or an array, which adds unnecessary complexity.

It is now replaced by the new utilities [`getDataIsArray`](#new-util-getdataisarray) and [`getResultIsArray`](#new-util-getresultisarray) which are more explicit about their purpose and usage. These utilities return `context.data` or `context.result` as an array, even if they are not arrays, making it easier to work with the data in your hooks.

Also see [#replace-items](#replace-items).

## `isNot`

The `isNot` predicate has been renamed to [`not`](/predicates/not.html).

## `keep`

The `keep` hook has been removed. Instead you can use [`transformData`](/hooks/transform-data.html) or [`transformResult`](/hooks/transform-result.html) with the [`pick` transformer](/transformers/pick.html).

The old `keep` hook also used spread arguments, which has been removed in favor of the new [`pick` transformer](/transformers/pick.html) that requires a single string or an array of field names.

```ts
import { transformData, transformResult } from "feathers-utils/hooks";
import { pick } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    all: [transformData(pick(["field1", "field2"]))],
  },
  after: {
    all: [transformResult(pick(["field1", "field2"]))],
  },
});
```

## `keepInArray`

The `keepInArray` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `keepQuery`

The `keepQuery` hook has been removed. Instead you can use `transformQuery` with the `pick` transformer.

The old `keepQuery` hook also used spread arguments, which has been removed in favor of the new [`pick transformer`](/transformers/pick.html) that requires a single string or an array of field names.

```ts
import { transformQuery } from "feathers-utils/hooks";
import { pick } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    all: [transformQuery(pick(["field1", "field2"]))],
  },
});
```

## `keepQueryInArray`

The `keepQueryInArray` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `lowerCase`

The `lowerCase` hook has been removed. Instead you can use `transformData` or `transformResult` with the `lowercase` transformer.

The old `lowerCase` hook also used spread arguments, which has been removed in favor of the new [`lowercase` transformer](/transformers/lowercase.html) that requires a single string or an array of field names.

```ts
import { transformData, transformResult } from "feathers-utils/hooks";
import { lowercase } from "feathers-utils/transformers";

app.service("users").hooks({
  before: {
    all: [transformData(lowercase(["email"]))],
  },
  after: {
    all: [transformResult(lowercase(["email"]))],
  },
});
```

## `mongoKeys`

The `mongoKeys` utility has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

If needed we should move it to `@feathersjs/mongodb`. 'feathers-utils' should be adapter agnostic and not contain any MongoDB specific utilities.

## `paramsForServer`

The old `paramsForServer` utility was removed. Now it's a hook.

## `populate`

The `populate` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

Nowadays it's recommended to use [resolvers](https://feathersjs.com/api/schema/resolvers.html), or [feathers-graph-populate](https://feathers-graph-populate.netlify.app/getting-started.html) or to use the underlying adapter (like `mongo` or `knex`) directly to populate data.

## `preventChanges`

The arguments for `preventChanges` have been simplified. Instead of using a boolean as the first argument, you can now pass an options object as the second argument. This allows for more flexibility and clarity in how you specify the fields to prevent changes on.

```ts
// old
import { preventChanges } from "feathers-hooks-common";
preventChanges(true, "security.badge");

// new
import { preventChanges } from "feathers-utils/hooks";
preventChanges("security.badge", { error: true });
```

## `replaceItems`

The `replaceItems` utility has been removed. It had too much magic. Based on `context.type` it replaced `context.data` or `context.result`. This does not play well with `around` hooks or for example when you early return `context.result` in a `before` hook and want to transform `context.result` in a `before` hook. Also it returned an object or an array, which adds unnecessary complexity.
It is now replaced by the new utilities [`replaceData`](#new-util-replacedata) and [`replaceResult`](#new-util-replaceresult) which are more explicit about their purpose and usage.

Related to [#get-items](#get-items).

## `required`

The `required` hook has been replaced with [`checkRequired`](/hooks/check-required.html).

## `runHook`

The `runHook` utility has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `runParallel`

The old `runParallel` hook has been removed. But we can add it back if needed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1)

## `serialize`

The `serialize` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `sequelizeConvert`

The `sequelizeConvert` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

It is not documented in 'feathers-hooks-common' anyways. But if you need it we should move it to 'feathers-sequelize'.

## `setNow`

The `setNow` hook has been removed. Instead you can use [`transformData`](/hooks/transform-data.html) or [`transformResult`](/hooks/transform-result.html) with the `setNow` transformer.

The old `setNow` hook used spread arguments to specify fields to set the current date, which has been removed in favor of the new [`setNow` transformer](/transformers/set-now.html) that requires a single string or an array of field names.

```ts
import { transformData, transformResult } from "feathers-utils/hooks";
import { setNow } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    createdAt: [transformData(setNow(["createdAt", "updatedAt"]))],
    updatedAt: [transformData(setNow(["updatedAt"]))],
    patchedAt: [transformData(setNow(["patchedAt"]))],
  },
});
```

## `sifter`

The `sifter` hook has been removed. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `softDelete`

The `softDelete` hook has been updated to require a `deletedQuery` and `removeData` option. This change improves clarity and consistency in how soft deletion is handled in your application.

## `traverse`

The `traverse` utility has been updated to require an explicit options object. This change improves clarity and consistency in how you specify options for traversing objects.

## `validate`

The `validate` hook has been removed. We plan on bringing it back into another library like `feathers-validation` or something similar. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## `validateSchema`

The `validateSchema` hook has been removed. We plan on bringing it back into another library like `feathers-validation` or something similar. If you need it please reach out to us in this [github issue](https://github.com/feathersjs/feathers-utils/issues/1).

## new hooks

### [`createRelated`](/hooks/create-related.html)

The new [`createRelated`](/hooks/create-related.html) hook allows you to create related items in a single operation. This can be useful for creating related items in a `create` operation without having to manually create them in a separate step.

### [`checkMulti`](/hooks/check-multi.html)

Early throw an error if the request is `.patch(null)` or `.remove(null)` and the service is defined as `multi: false`. This is useful to prevent accidental multi operations on services that are not configured for it.

### [`onDelete`](/hooks/on-delete.html)

The new [`onDelete`](/hooks/on-delete.html) hook allows you to perform actions when an item is deleted. This can be useful for cleaning up related data or performing other actions when an item is deleted.

### [`skippable`](/hooks/skippable.html)

Also see [`shouldSkip`](/predicates/should-skip.html) and [`addSkip`](/utils/add-skip.html).

### [`throwIf`](/hooks/throw-if.html)

The new [`throwIf`](/hooks/throw-if.html) hook allows you to throw an error if a certain condition is met. This can be useful for validating conditions before proceeding with the hook chain.

### [`throwIfIsProvider`](/hooks/throw-if-is-provider.html)

### [`throwIfIsMulti`](/hooks/throw-if-is-multi.html)

### [`transformData`](/hooks/transform-data.html)

The new [`transformData`](/hooks/transform-data.html) hook allows you to transform the data of a hook call. It's very flexible and is meant to be used with the new [transformers](/transformers/). This can be useful for modifying the data before it is processed by the service.

### [`transformQuery`](/hooks/transform-query.html)

The new [`transformQuery`](/hooks/transform-query.html) hook allows you to transform the query of a hook call. It's very flexible and is meant to be used with the new [transformers](/transformers/). This can be useful for modifying the query before it is processed by the service.

### [`transformResult`](/hooks/transform-result.html)

The new [`transformResult`](/hooks/transform-result.html) hook allows you to transform the result of a hook call. It's very flexible and is meant to be used with the new [transformers](/transformers/). This can be useful for modifying the result before it is returned to the client.

## new utils

### [`addSkip`](/utils/add-skip.html)

In conjunction with the [`skippable` hook](/hooks/skippable.html) and [`shouldSkip` predicate](/predicates/should-skip.html) the new [`addSkip` utility](/utils/add-skip.html) allows you to add a skip flag to the context. This can be useful for conditionally skipping hooks based on certain criteria.

### [`getDataIsArray`](/utils/get-data-is-array.html)

The new [`getDataIsArray`](/utils/get-data-is-array.html) utility returns `context.data` as an array, even if it is not an array. This can be useful for ensuring that you always work with an array in your hooks, regardless of the input type.

### [`getResultIsArray`](/utils/get-result-is-array.html)

The new [`getResultIsArray`](/utils/get-result-is-array.html) utility returns `context.result` as an array, even if it is not an array. This can be useful for ensuring that you always work with an array in your hooks, regardless of the input type.

### [`iterateFind`](/utils/iterate-find.html)

The new [`iterateFind`](/utils/iterate-find.html) utility allows you to iterate over the results of a `find` operation. This can be useful for processing each item in the result set individually, without having to worry about the original result structure (array, object, paginated).

### [`mutateData`](/utils/mutate-data.html)

The new [`mutateData`](/utils/mutate-data.html) utility mutates `context.data` item by item. This can be useful for transforming the data in your hooks without having to worry about the original data structure (array, object).

### [`mutateResult`](/utils/mutate-result.html)

The new [`mutateResult`](/utils/mutate-result.html) utility mutates `context.result` item by item. This can be useful for transforming the result in your hooks without having to worry about the original result structure (array, object, paginated).

### [`getPaginate`](/utils/get-paginate.html)

The new [`getPaginate`](/utils/get-paginate.html) utility returns the pagination information from `context.params` or `service.options.paginate` or `context.params.adapter`.

### [`patchBatch`](/utils/patch-batch.html)

The new [`patchBatch`](/utils/patch-batch.html) utility allows you to batch patch operations in your hooks. This can be useful for optimizing performance when you need to update multiple items with varying data.

## [`skipResult`](/utils/skip-result.html)

The new [`skipResult`](/utils/skip-result.html) utility allows you to skip the result of a hook call. This can be useful for early returns in your hooks without having to modify the `context.result` directly. It knows when to set an array, a paginated result or `null`.

## Transformers

Transformers are functions that modify the data or result of a Feathers service call. They can be used to apply transformations such as trimming strings, converting dates, or omitting fields from the data or result.

Instead of using the old `discard`, `keep`, `lowerCase`, `setNow`, and other similar hooks, you can now use the new [`transformData`](/hooks/transform-data.html) and [`transformResult`](/hooks/transform-result.html) hooks with the appropriate transformers.

For example, instead of using the old `discard` hook, you can now use the new [`omit` transformer](/transformers/omit.html) with the `transformData` or `transformResult` hooks:

```ts
import { transformData, transformResult } from "feathers-utils/hooks";
import { omit } from "feathers-utils/transformers";

app.service("my-service").hooks({
  before: {
    all: [transformData(omit(["field1", "field2"]))],
  },
  after: {
    all: [transformResult(omit(["field1", "field2"]))],
  },
});
```

## new predicates

### [`isContext`](/predicates/is-context.html)

With the new [`isContext`](/predicates/is-context.html) predicate you can filter `context` by specific properties.

### [`isMulti`](/predicates/is-multi.html)

The new [`isMulti`](/predicates/is-multi.html) predicate checks if the context is a multi operation (e.g., a `find` operation). This can be useful for conditionally applying hooks based on whether the operation is multi or not.

### [`isPaginated`](/predicates/is-paginated.html)

The new [`isPaginated`](/predicates/is-paginated.html) predicate checks if the context is paginated. This can be useful for conditionally applying hooks based on whether the operation is paginated or not.

### [`shouldSkip`](/predicates/should-skip.html)

The new [`shouldSkip`](/predicates/should-skip.html) predicate checks for `params.skipHooks`
