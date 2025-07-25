## feathers-utils

#### hooks

- added transformData, transformResult, rm alterItems
- added discardData, discardResult, rm discard
  - moved to omitData, omitResult, rm omit
  - MaybeArray
- added keepData, keepResult, rm keep
  - moved to pickData, pickResult, rm pick
  - MaybeArray
- added lowercaseData, lowercaseResult, rm lowercase
  - MaybeArray
- added setNowData, setNowResult, rm setNow

- removed several checks that are handled by typescript
- removed check for `preventChanges(true, ...fieldNames)`
  - switch `true` to second argument options
  - async

- renamed 'keepQuery' to 'pickQuery', added alias
- renamed 'required' to 'checkRequired', added alias

- removed 'runParallel'

- removed 'actOn', 'actOnDefault', 'actOnDispatch'

- added throwIf
- added throwIfIsProvider
- added throwIfIsMulti

- removed old paramsForServer & changed to hook

- removed 'callingParams'

- removed 'checkContextIf'

- added 'onDelete' & 'createRelated'
- added 'checkMulti'
- added 'shouldSkip' & 'skippable'

- stashBefore multi

- softDelete: added 'transformParams' & added 'key' option

- disallow: MaybeArray

- rm support for spread argument

- rm 'actOnDispatch' & 'actOnDefault'

- rm 'validate', 'validateSchema', 'setNow', 'sequelizeConvert', 'serialize', 'required', 'runHook', 'populate', 'pick', 'omit', 'mongoKeys', 'lowercase', 'lowerCase', 'keepQuery', 'keepQueryInArray', 'isNot', fgraphql', 'fastJoin', 'discard...', 'dePopulate', 'actOnDefault', 'actOnDispatch', 'sifter'

- softDelete: need to pass 'deletedQuery' and 'removeData'

- traverse options object & getObject explicitly required

- cache changed

#### predicates

- renamed 'isNot' to 'not' (added alias for 'isNot')
- added predicate isMulti
- added predicate isPaginated
- added predicate isContext

#### utils

- added getDataIsArray, getResultIsArray, rm getItems
- added mutateData, mutateResult, rm replaceItems
- added util getPaginate
- added util skipResult
- rm 'runHook'

### Hooks to discuss

- cache
- populate
- dePopulate
- fgraphql
- fastJoin
- sequelizeConvert
- serialize

<p align="center">
  <img src="https://utils.feathersjs.com/feathers-utils-logo.png" width="200">
</p>

[![npm](https://img.shields.io/npm/v/feathers-utils)](https://www.npmjs.com/package/feathers-utils)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/feathersjs/feathers-utils/CI/master)](https://github.com/feathersjs/feathers-utils/actions/workflows/nodejs.yml?query=branch%3Amaster)
[![libraries.io](https://img.shields.io/librariesio/release/npm/feathers-utils)](https://libraries.io/npm/feathers-utils)
[![npm](https://img.shields.io/npm/dm/feathers-utils)](https://www.npmjs.com/package/feathers-utils)
[![GitHub license](https://img.shields.io/github/license/feathersjs/feathers-utils)](https://github.com/feathersjs/feathers-utils/blob/master/LICENSE)
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.gg/qa8kez8QBx)

A collection of useful hooks and utils to use with Feathers services.

> NOTE: This is the version for Feathers v5. For Feathers v4 use [feathers-utils v6](https://github.com/feathersjs/feathers-utils/tree/crow)

```
npm install feathers-utils --save
```

## Documentation

For the full list and API of available hooks and utilities, refer to the [feathers-utils documentation](https://utils.feathersjs.com/).

## Tests

`npm test` to run tests.

## License

See [LICENSE](LICENSE).
