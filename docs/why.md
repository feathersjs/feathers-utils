# Why we moved from `feathers-hooks-common` to `feathers-utils`

This is a long way coming. One thing led to another. To understand the whole picture we need to start at the beginning.

## 1. `getItems` and `replaceItems` were not compatible with `around` hooks

Feathers v5 introduced the concept of [`around` hooks](https://feathersjs.com/api/hooks.html#around). Some of the hooks in `feathers-hooks-common` were not compatible with this new concept. This was the first step towards a new mechanism that would be compatible with Feathers v5 and beyond. 'feathers-hooks-common' was not compatible with `around` hooks because it uses [`getItems`](https://github.com/feathersjs-ecosystem/feathers-hooks-common/blob/master/src/utils/get-items.ts) and [`replaceItems`](https://github.com/feathersjs-ecosystem/feathers-hooks-common/blob/master/src/utils/replace-items.ts). These two utilities return items from `context.data` or `context.result` based on wether it was in a `before` or `after` hook. This does not play well with `around` hooks and honestly was probably a mistake in the first place. Why not an explicit `getData` and `getResult` utility? So we developed [`getDataIsArray`](/utils/get-data-is-array.html) and [`getResultIsArray`](/utils/get-result-is-array.html).

## 2. Naming issues in `feathers-hooks-common`

The naming of some hooks in `feathers-hooks-common` always felt a bit off:

- `alterItems`: `alter` is not a word you see often in other libraries. While we needed to change it at least to `alterData` and `alterResult` for earlier described reasons, we decided to rename it to `transformData` and `transformResult`.
- `discard`: `feathers-hooks-common` provides `disallow` and `discard`. Two hooks that sound too similar while `omit` is a much more common term. So initially we introduced `omitData` and `omitResult` but changed that to the [`omit` transformer](/transformers/omit.html) later
- `keep*`: This is quite similar to `discard` and `omit`. We decided to rename it to `pick` which is a more common term in the JavaScript ecosystem. So initially we introduced `pickData` and `pickResult` but changed that to the [`pick` transformer](/transformers/pick.html) later.

## 3. Spread arguments

Most hooks of `feathers-hooks-common` use spread operator to pass arguments. This makes it impossible to add features to these hooks. We changed all applicable hooks to use no spread operator and an array instead. We also added an options object where needed. This allows us to add new features in the future without breaking changes. For example `preventChanges` now can take an options object as the second argument. This allows us to add new options in the future without breaking changes.

## 4. Hooks I don't know anyone uses anymore

The first two points above did not necessarily require a new package. But being in a massive refactoring (check out an earlier [refactoring PR](https://github.com/feathersjs-ecosystem/feathers-hooks-common/pull/764)) we decided to remove some hooks that we don't think anyone uses anymore. In particular these are:

- `fgraphql`: Not documented anyways. Reading the [source code](https://github.com/feathersjs-ecosystem/feathers-hooks-common/blob/master/src/hooks/fgraphql.ts) it's hard to understand what it does.
- [`fastJoin`](https://hooks-common.feathersjs.com/hooks.html#fastjoin): This also is quite too complicated to implement. See the [docs](https://hooks-common.feathersjs.com/hooks.html#fastjoin)
- [`populate`](https://hooks-common.feathersjs.com/hooks.html#populate)/[`depopulate`](https://hooks-common.feathersjs.com/hooks.html#depopulate): `fastJoin` was already recommended over `populate`. Nowadays it's recommended to use [resolvers](https://feathersjs.com/api/schema/resolvers.html), or [feathers-graph-populate](https://feathers-graph-populate.netlify.app/getting-started.html) or to use the underlying adapter (like `mongo` or `knex`) directly to populate data.
- [`keepInArray`](https://hooks-common.feathersjs.com/hooks.html#keepinarray)/[`keepQueryInArray`](https://hooks-common.feathersjs.com/hooks.html#keepqueryinarray): Too specific use case(?) probably better to implement this in user space.
- [`mongoKeys`](https://hooks-common.feathersjs.com/hooks.html#mongokeys): Hooks specific for a certain database adapter should not be in a common package.
- [`serialize`](https://hooks-common.feathersjs.com/hooks.html#serialize): Too specific use case(?), probably better to implement this with resolvers.
- `sequelizeConvert`: Never documented anyways. Same as `mongoKeys`, this is a hook specific for a certain database adapter and should not be in a common package.
- [`validate`](https://hooks-common.feathersjs.com/hooks.html#validate)/[`validateSchema`](https://hooks-common.feathersjs.com/hooks.html#validateschema): Two hooks basically doing the same thing. It also uses ajv. It's not good to be used in a common package. We plan on bringing it back into another library like `feathers-validation` or something similar.

That being said, we are open to reintroducing these hooks if someone can provide a good use case and implementation [in this issue](https://github.com/feathersjs/feathers-utils/issues/1).

## 5. Suboptimal hook implementations

Some hooks/utils in `feathers-hooks-common` were not implemented in the best way:

- [cache](https://hooks-common.feathersjs.com/hooks.html#cache)
  - does only cache `get` request no `find` requests
  - recommends using a very old version of `@feathers-plus/cache`
  - does not handle varying params
- [softDelete](https://hooks-common.feathersjs.com/hooks.html#softdelete)
  - uncommon defaults with `{ deleted: true }`
  - does not handle `.remove(null)`
- [paramsForServer](https://hooks-common.feathersjs.com/utilities.html#paramsforserver)
  - was implemented as a utility, not a hook

It's hard to change these things without breaking changes. One way would have been to introduce new hooks like `cache2` or `softDelete2`, deprecate the old ones and then remove and rename them im future releases. That would have been a lot of noise and would have made the package harder to maintain. Instead we decided to remove these hooks and implement them in a better way in `feathers-utils`. For example:

- [`cache`](/hooks/cache.html): A hook that caches `find` and `get` requests and handles params. It's hardly inspired by the very good [`contextCache`](https://daddywarbucks.github.io/feathers-fletching/#/./hooks?id=contextcache) by [@daddywarbucks](https://github.com/DaddyWarbucks).
- [`softDelete`](/hooks/soft-delete.html): A hook that soft deletes items. You need to define `deletedQuery` and `removeData` explicitly. In jsdoc it's recommended to use `{ deletedAt: new Date() }`.

## 6. Overall repository structure

We wanted to have a more modular structure. `feathers-hooks-common` has a folder for `src` files, a `test` folder and a `docs` folder with a single `.md` file for hooks and one for utilities. Especially the documentation was hard to maintain. Because every hook had a very specific structure, it was hard to keep the documentation up to date. That made additions difficult and therefore community packages emerged like [feathers-fletching](https://daddywarbucks.github.io/feathers-fletching/) and [@fratzinger/feathers-utils](https://github.com/fratzinger/feathers-utils) which solved similar problems.

We aimed for modular structure that makes new additions and maintenance easier. We found a pretty clean approach. Now every hook and utility has its own folder with the source code, the test file and a `.md` file. This makes it super easy to add new hooks and utilities.

If you want to add a new hook, simply start by copying an existing hook, modify the source code and the test file. Then update the `.md` file (basically just changing the `title` is good enough to get started). Then add the hook to the `src/hooks/index.ts` barrel file and you're good to go. The docs pick up the new hook automatically. The same applies to utilities. The docs are then built by analyzing the source code and jsdoc comment. This helps to keep the documentation up to date and makes it easier to add new hooks and utilities.

This allowed us to add new hooks much more easily. For example:

- [`onDelete`](/hooks/on-delete.html): A hook that runs `CASCADE` or `SET NULL` on related documents when an item is removed.
- [`setData`](/hooks/set-data.html): A hook that sets data on the context.
- [`skippable`](/hooks/skippable.html): A hook that can be skipped based on certain conditions.
- [`throwIf`](/hooks/throw-if.html): A hook that throws an error if a certain condition is met.

For a more complete list check the [migration guide](/migrating-from-feathers-hooks-common.html) or browse the [hooks section](/hooks/) in the docs.

## 7. New utilities

This is where the name `feathers-hooks-common` did not fit anymore. We added a few new utilities and want to add more in the future. Some new utilities are:

- [`addSkip`](/utils/add-skip.html): A utility that adds a `skip` property to the context.
- [`contextToJson`](/utils/context-to-json.html): A utility that converts the context to JSON.
- [`getExposedMethods`](/utils/get-exposed-methods.html)
- [`getPaginate`](/utils/get-paginate.html): A utility that gets the pagination information from the context.
- [`iterateFind`](/utils/iterate-find.html)
- [`patchBatch`](/utils/patch-batch.html)
- [`skipResult`](/utils/skip-result.html)

For a more complete list check the [migration guide](/migrating-from-feathers-hooks-common.html) or browse the [utils section](/utils/) in the docs.

## 8. New transformers

While revisiting we found that some hooks basically did the same thing: use `transformData` or `transformResult` and pass in an anonymous function. We decided to introduce a few new transformers that can be used with `transformData` and `transformResult`. We don't need to add a bunch of new hooks for every use case. Instead we can use these transformers to transform the data or result in a more generic way. Some examples are:

- `keep('field1', 'field2')`: now is `transformData(pick(['field1', 'field2']))` or `transformResult(pick(['field1', 'field2']))`
- `keepQuery('field1', 'field2')`: now is `transformQuery(pick(['field1', 'field2']))`
- `discard('field1', 'field2')`: now is `transformData(omit(['field1', 'field2']))` or `transformResult(omit(['field1', 'field2']))`
- `discardQuery('field1', 'field2')`: now is `transformQuery(omit(['field1', 'field2']))`
- `lowerCase('field1', 'field2')`: now is `transformData(lowerCase(['field1', 'field2']))` or `transformResult(lowerCase(['field1', 'field2']))`
- `setNow('field1', 'field2')`: now is `transformData(setNow(['field1', 'field2']))` or `transformResult(setNow(['field1', 'field2']))`

These hooks basically all work the same way. The decision to use explicit `data` and `result` hooks would have forced us to create two hooks for each mechanism. We planned to add more hooks like `trimData`, `trimResult`, `parseDateData` etc. Which adds a lot of complexity and maintenance overhead. Instead we removed these explicit hooks and decided to go with the transformers. This allows us to test each transformer separately and use them in the `transformData` and `transformResult` hooks. This also allows us to add new transformers without any noise. As you can see in the examples above the DX is not worse than before `setNow()` -> `transformData(setNow())`. In fact, it is even better because code is reused and less mental overhead is required to understand the code. Built in transformers for now are:

- [`lowercase`](/transformers/lower-case.html): Lowercases the given fields.
- [`omit`](/transformers/omit.html): Omits the given fields.
- [`parseDate`](/transformers/parse-date.html): Parses the given fields as dates.
- [`pick`](/transformers/pick.html): Picks the given fields.
- [`setNow`](/transformers/set-now.html): Sets the current date/time on the given fields.
- [`trim`](/transformers/trim.html): Trims the given fields.

If you have ideas for new transformers, please open an issue in the [feathers-utils repository](https://github.com/feathersjs/feathers-utils).

## Conclusion

It was clear there were a lot of changes we wanted to make and a bunch of new things to add where the name `feathers-hooks-common` simply did not fit anymore. We considered a few names and scopes and finally came up with `feathers-utils` because it's short and describes this package best. The one downside of this package is, that [@fratzinger](https://github.com/fratzinger) used this name on npm for his own package. We agreed to switch the name to `feathers-utils` and he renamed his package to [`@fratzinger/feathers-utils`](https://github.com/fratzinger/feathers-utils). Therefore the new `feathers-utils` starts with version `v10` to get a fresh start. We hope you like the new package and the new features. If you have any questions or suggestions, please open an issue in the github repository.

If you came this far and want to learn more about the new hooks and utilities, check out the [migration guide](/migrating-from-feathers-hooks-common.html) or browse the [hooks section](/hooks/) and [utils section](/utils/) in the docs. If you want to contribute, please open a new issue or pull request. We are looking forward to your contributions!
