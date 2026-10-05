import { assert } from 'vitest'
import * as exportedHooks from '../src/hooks/index.js'
import * as exportedUtils from '../src/utils/index.js'
import * as exportedPredicates from '../src/predicates/index.js'
import * as exportedTransformers from '../src/transformers/index.js'
import * as exportedTesting from '../src/testing/index.js'

const hooks = [
  'aggregate',
  'cache',
  'check',
  'checkMulti',
  'checkRequired',
  'combine',
  'createRelated',
  'debug',
  'denormalize',
  'disablePagination',
  'disallow',
  'findOrCreate',
  'FROM_CLIENT_FOR_SERVER_DEFAULT_KEY',
  'generated',
  'iff',
  'iffElse',
  'muteEvent',
  'onDelete',
  'paramsForServer',
  'paramsFromClient',
  'preventChanges',
  'rateLimit',
  'restrictQuery',
  'resolve',
  'resolveData',
  'resolveQuery',
  'resolveResult',
  'setData',
  'setField',
  'setQueryDefaults',
  'setResult',
  'setSlug',
  'skipUnchanged',
  'skippable',
  'softDelete',
  'stashable',
  'throwIf',
  'throwIfIsMulti',
  'throwIfIsProvider',
  'transformData',
  'transformQuery',
  'transformResult',
  'traverse',
  'trigger',
  'unless',
  'unique',
  'when',
] satisfies (keyof typeof exportedHooks)[]

const utils = [
  'addSkip',
  'addToQuery',
  'checkContext',
  'chunkFind',
  'contextToJson',
  'count',
  'createMany',
  'defineHooks',
  'defineStash',
  'dotifyQuery',
  'findAll',
  'eqOrIn',
  'gateParams',
  'getDataIsArray',
  'getChanges',
  'getExposedMethods',
  'getIdField',
  'getMergedData',
  'getPaginate',
  'getResultIsArray',
  'iterateFind',
  'mergeQuery',
  'mutateData',
  'mutateResult',
  'neOrNin',
  'nestifyQuery',
  'patchBatch',
  'patchMany',
  'queryDefaults',
  'queryHasProperty',
  'removeMany',
  'replaceData',
  'replaceResult',
  'simplifyQuery',
  'skipResult',
  'sortQueryProperties',
  'stash',
  'stashed',
  'stringifyParams',
  'toPaginated',
  'transformParams',
  'unpaginate',
  'waitForServiceEvent',
  'walkQuery',
  'zipDataResult',
] satisfies (keyof typeof exportedUtils)[]

const predicates = [
  'isProvider',
  'isMulti',
  'not',
  'and',
  'every',
  'or',
  'some',
  'isContext',
  'isPaginated',
  'isSelected',
  'shouldSkip',
  // re-export hooks
  'iff',
  'iffElse',
  'unless',
  'skippable',
  'throwIf',
  'when',
] satisfies (keyof typeof exportedPredicates)[]

const transformers = [
  'defaults',
  'setNow',
  'lowercase',
  'trim',
  'parseDate',
  'pick',
  'omit',
  // re-export hooks
  'transformData',
  'transformQuery',
  'transformResult',
  // re-export utils
  'mutateData',
  'mutateResult',
] satisfies (keyof typeof exportedTransformers)[]

// `testing` is deliberately absent from the root barrel — it is test-only code
// and should not ride along in a production bundle.
const testing = [
  'deepFreeze',
  'expectNoSideEffects',
  'recordHooks',
  'runHook',
] satisfies (keyof typeof exportedTesting)[]

describe('expose', () => {
  it('expose all hooks', () => {
    assert.deepEqual(Object.keys(exportedHooks).sort(), hooks.sort())
  })
  it('expose all utils', () => {
    assert.deepEqual(Object.keys(exportedUtils).sort(), utils.sort())
  })
  it('expose all predicates', () => {
    assert.deepEqual(Object.keys(exportedPredicates).sort(), predicates.sort())
  })
  it('expose all transformers', () => {
    assert.deepEqual(
      Object.keys(exportedTransformers).sort(),
      transformers.sort(),
    )
  })
  it('expose all testing utilities', () => {
    assert.deepEqual(Object.keys(exportedTesting).sort(), testing.sort())
  })

  it('expose all members', () => {
    assert.deepEqual(
      [
        ...Object.keys(exportedHooks).sort(),
        ...Object.keys(exportedUtils).sort(),
      ].sort(),
      [...hooks, ...utils].sort(),
    )
  })
})
