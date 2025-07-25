import { assert } from 'vitest'
import { traverse } from './traverse.hook.js'
import copy from 'fast-copy'

describe('traverse', () => {
  let hookBefore: any
  let hookBeforeArray: any
  let trimmer: (transformContext: any) => void
  let hookAfter: any
  let hookAfterArray: any

  beforeEach(() => {
    hookBefore = {
      type: 'before',
      method: 'create',
      data: { a: ' a  b  ' },
      params: { query: { b: '  b  b  ' } },
    }

    hookBeforeArray = {
      type: 'before',
      method: 'create',
      data: [{ a: ' a  b  ' }, { c: ' c ' }],
      params: { query: { b: '  b  b  ' }, something: { c: ' c', d: 'd ' } },
    }

    hookAfter = {
      type: 'after',
      method: 'create',
      data: { q: 1 },
      params: { query: { b: '  b  b  ' } },
      result: { a: ' a  b  ' },
    }

    hookAfterArray = {
      type: 'after',
      method: 'create',
      data: { q: 1 },
      params: { query: { b: '  b  b  ' } },
      result: [{ a: ' a  b  ' }, { c: ' c ' }],
    }

    trimmer = function (this: any, node: any) {
      if (typeof node === 'string') {
        this.update(node.trim())
      }
    }
  })

  it('transforms hook.data single item', () => {
    const result = copy(hookBefore)
    result.data = { a: 'a  b' }

    traverse({ transformer: trimmer, getObject: (context) => context.data })(
      hookBefore,
    )

    assert.deepEqual(hookBefore, result)
  })

  it('transforms hook.data array of items', () => {
    const result = copy(hookBeforeArray)
    result.data = [{ a: 'a  b' }, { c: 'c' }]

    traverse({ transformer: trimmer, getObject: (context) => context.data })(
      hookBeforeArray,
    )

    assert.deepEqual(hookBeforeArray, result)
  })

  it('transforms hook.result single item', () => {
    const result = copy(hookAfter)
    result.result = { a: 'a  b' }

    traverse({ transformer: trimmer, getObject: (context) => context.result })(
      hookAfter,
    )

    assert.deepEqual(hookAfter, result)
  })

  it('transforms hook.result array of items', () => {
    const result = copy(hookAfterArray)
    result.result = [{ a: 'a  b' }, { c: 'c' }]

    traverse({ transformer: trimmer, getObject: (context) => context.result })(
      hookAfterArray,
    )

    assert.deepEqual(hookAfterArray, result)
  })

  it('transforms hook.params.query', () => {
    const result = copy(hookBefore)
    result.params.query = { b: 'b  b' }

    traverse({
      transformer: trimmer,
      getObject: (context) => context.params.query,
    })(hookBefore)

    assert.deepEqual(hookBefore, result)
  })

  it('transforms multiple objects within a hook', () => {
    const result = copy(hookBeforeArray)
    result.params = { query: { b: 'b  b' }, something: { c: 'c', d: 'd' } }

    traverse({
      transformer: trimmer,
      getObject: (hook: any) => [hook.params.query, hook.params.something],
    })(hookBeforeArray)

    assert.deepEqual(hookBeforeArray, result)
  })

  it('transforms objects', () => {
    const obj: any = { query: { b: 'b  b' }, something: { c: 'c', d: 'd' } }
    const result = copy(obj)

    traverse({ transformer: trimmer, getObject: (context) => result })(
      hookBeforeArray,
    )

    assert.deepEqual(obj, result)
  })
})
