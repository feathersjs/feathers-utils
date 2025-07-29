import type { HookContext } from '@feathersjs/feathers'
import { addSkip } from './add-skip.util.js'

describe('addSkip', function () {
  it('adds skipHooks to context.params', function () {
    const context = { params: {} } as HookContext
    addSkip(context, 'before')
    assert.deepStrictEqual(context.params.skipHooks, ['before'])
  })

  it('adds multiple skipHooks to context.params', function () {
    const context = { params: {} } as HookContext
    addSkip(context, ['before', 'after'])
    assert.deepStrictEqual(context.params.skipHooks, ['before', 'after'])
  })

  it('merges new skipHooks with existing ones', function () {
    const context = { params: { skipHooks: ['before'] } } as HookContext
    addSkip(context, 'after')
    assert.deepStrictEqual(context.params.skipHooks, ['before', 'after'])
  })

  it('throws an error if skipHooks is not an array', function () {
    const context = { params: { skipHooks: 'invalid' } } as HookContext
    expect(() => {
      addSkip(context, 'after')
    }).toThrow('Invalid skipHooks parameter')
  })
})
