import { assert } from 'vitest'
import * as exportedHooks from '../src/hooks/index.js'
import * as exportedUtils from '../src/utils/index.js'
import * as exportedPredicates from '../src/predicates/index.js'
import * as exportedTransformers from '../src/transformers/index.js'

const hooks = [
  'cache',
  'checkMulti',
  'checkRequired',
  'combine',
  'createRelated',
  'debug',
  'disablePagination',
  'disallow',
  'iff',
  'iffElse',
  'onDelete',
  'paramsForServer',
  'paramsFromClient',
  'preventChanges',
  'setData',
  'setField',
  'setResult',
  'setSlug',
  'skippable',
  'softDelete',
  'stashBefore',
  'throwIf',
  'throwIfIsMulti',
  'throwIfIsProvider',
  'transformData',
  'transformQuery',
  'transformResult',
  'traverse',
  'unless',
  'when',
] satisfies (keyof typeof exportedHooks)[]

const utils = [
  'addSkip',
  'addToQuery',
  'checkContext',
  'contextToJson',
  'defineHooks',
  'getDataIsArray',
  'getExposedMethods',
  'getPaginate',
  'getResultIsArray',
  'iterateFind',
  'mutateData',
  'mutateResult',
  'patchBatch',
  'skipResult',
  'toPaginated',
  'transformParams',
  'walkQuery',
] satisfies (keyof typeof exportedUtils)[]

const predicates = [
  'isProvider',
  'isMulti',
  'not',
  'every',
  'some',
  'isContext',
  'isPaginated',
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

  it('expose all members', () => {
    assert.deepEqual(
      [
        ...Object.keys(exportedHooks).sort(),
        ...Object.keys(exportedUtils).sort(),
        ...Object.keys(exportedPredicates).sort(),
      ].sort(),
      [...hooks, ...utils, ...predicates].sort(),
    )
  })
})
