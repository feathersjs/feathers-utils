import { assert } from 'vitest'
import { transformResult } from './transform-result.hook.js'
import type { HookContext } from '@feathersjs/feathers'

let hookAfter: any
let hookFindPaginate: any
let hookFind: any

describe('transformResult', () => {
  beforeEach(() => {
    hookAfter = {
      type: 'after',
      method: 'create',
      params: { provider: 'rest' },
      result: { first: 'Jane', last: 'Doe' },
    }
    hookFindPaginate = {
      type: 'after',
      method: 'find',
      params: { provider: 'rest' },
      result: {
        total: 2,
        data: [
          { first: 'John', last: 'Doe' },
          { first: 'Jane', last: 'Doe' },
        ],
      },
    }
    hookFind = {
      type: 'after',
      method: 'find',
      params: { provider: 'rest' },
      result: [
        { first: 'John', last: 'Doe' },
        { first: 'Jane', last: 'Doe' },
      ],
    }
  })

  it('updates hook after::find with pagination', () => {
    transformResult((item: any) => {
      delete item.last
    })(hookFindPaginate)

    assert.deepEqual(hookFindPaginate.result.data, [
      { first: 'John' },
      { first: 'Jane' },
    ])
  })

  it('updates hook after::find with no pagination', () => {
    transformResult((item: any) => {
      item.new = item.first
    })(hookFind)

    assert.deepEqual(hookFind.result, [
      { first: 'John', last: 'Doe', new: 'John' },
      { first: 'Jane', last: 'Doe', new: 'Jane' },
    ])
  })

  it('updates hook after', () => {
    transformResult((item: any) => {
      item.new = item.first
    })(hookAfter)

    assert.deepEqual(hookAfter.result, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
  })

  it('updates hook after::find with pagination with new item returned', () => {
    transformResult((item: any) => ({ first: item.first }))(hookFindPaginate)

    assert.deepEqual(hookFindPaginate.result.data, [
      { first: 'John' },
      { first: 'Jane' },
    ])
  })

  it('updates hook after::find with pagination with new item returned', () => {
    transformResult((item: any) => ({ ...item, new: item.first }))(hookFind)

    assert.deepEqual(hookFind.result, [
      { first: 'John', last: 'Doe', new: 'John' },
      { first: 'Jane', last: 'Doe', new: 'Jane' },
    ])
  })

  it('updates hook after with new item returned', () => {
    transformResult((item: any) => ({ ...item, new: item.first }))(hookAfter)

    assert.deepEqual(hookAfter.result, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
  })

  it('updates hook after::create', async () => {
    await transformResult((item: any) => {
      item.new = item.first
      return Promise.resolve()
    })(hookAfter)

    assert.deepEqual(hookAfter.result, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
  })

  it('updates hook after::create with new item returned', async () => {
    await transformResult((item: any) =>
      Promise.resolve({ ...item, new: item.first }),
    )(hookAfter)

    assert.deepEqual(hookAfter.result, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
  })

  it('updates hook after::find with pagination', async () => {
    await transformResult((item: any) => {
      delete item.last
      return Promise.resolve()
    })(hookFindPaginate)

    assert.deepEqual(hookFindPaginate.result.data, [
      { first: 'John' },
      { first: 'Jane' },
    ])
  })

  it('updates hook after::find with no pagination', async () => {
    await transformResult((item: any) => {
      item.new = item.first
      return Promise.resolve()
    })(hookFind)

    assert.deepEqual(hookFind.result, [
      { first: 'John', last: 'Doe', new: 'John' },
      { first: 'Jane', last: 'Doe', new: 'Jane' },
    ])
  })

  it('updates hook after::find with pagination with new item returned', async () => {
    await transformResult((item: any) =>
      Promise.resolve({ first: item.first }),
    )(hookFindPaginate)

    assert.deepEqual(hookFindPaginate.result.data, [
      { first: 'John' },
      { first: 'Jane' },
    ])
  })

  it('updates hook after::find with no pagination with new item returned', async () => {
    await transformResult((item: any) =>
      Promise.resolve({ ...item, new: item.first }),
    )(hookFind)

    assert.deepEqual(hookFind.result, [
      { first: 'John', last: 'Doe', new: 'John' },
      { first: 'Jane', last: 'Doe', new: 'Jane' },
    ])
  })

  it('updates dispatch', () => {
    const context = {
      type: 'after',
      method: 'create',
      params: { provider: 'rest' },
      result: { first: 'Jane', last: 'Doe' },
      dispatch: { first: 'Jack', last: 'Doe' },
    } as HookContext

    transformResult(
      (item: any) => {
        item.new = item.first
      },
      { dispatch: true },
    )(context)

    assert.deepEqual(context.result, { first: 'Jane', last: 'Doe' })
    assert.deepEqual(context.dispatch, {
      first: 'Jack',
      last: 'Doe',
      new: 'Jack',
    })
  })

  it('updates dispatch even though it is not defined', () => {
    const context = {
      type: 'after',
      method: 'create',
      params: { provider: 'rest' },
      result: { first: 'Jane', last: 'Doe' },
      dispatch: undefined,
    } as HookContext

    transformResult(
      (item: any) => {
        item.new = item.first
      },
      { dispatch: true },
    )(context)

    assert.deepEqual(context.result, { first: 'Jane', last: 'Doe' })
    assert.deepEqual(context.dispatch, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
  })

  it('updates dispatch and result', () => {
    const context = {
      type: 'after',
      method: 'create',
      params: { provider: 'rest' },
      result: { first: 'Jane', last: 'Doe' },
      dispatch: { first: 'Jack', last: 'Doe' },
    } as HookContext

    transformResult(
      (item: any) => {
        item.new = item.first
      },
      { dispatch: 'both' },
    )(context)

    assert.deepEqual(context.result, {
      first: 'Jane',
      last: 'Doe',
      new: 'Jane',
    })
    assert.deepEqual(context.dispatch, {
      first: 'Jack',
      last: 'Doe',
      new: 'Jack',
    })
  })
})
