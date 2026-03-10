import { assert } from 'vitest'
import { transformData } from './transform-data.hook.js'

let hookBefore: any
let hookCreateMulti: any

describe('transformData', () => {
  beforeEach(() => {
    hookBefore = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest' },
      data: { first: 'John', last: 'Doe' },
    }
    hookCreateMulti = {
      type: 'before',
      method: 'create',
      params: { provider: 'rest' },
      data: [
        { first: 'John', last: 'Doe' },
        { first: 'Jane', last: 'Doe' },
      ],
    }
  })

  it('context is 2nd param', () => {
    let contextParam
    transformData((_rec: any, { context }: any) => {
      contextParam = context
    })(hookBefore)
    assert.deepEqual(contextParam, hookBefore)
  })

  it('updates hook before::create', () => {
    transformData((item: any) => {
      item.state = 'UT'
    })(hookBefore)
    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create::multi', () => {
    transformData((item: any) => {
      item.state = 'UT'
    })(hookCreateMulti)
    assert.deepEqual(hookCreateMulti.data, [
      { first: 'John', last: 'Doe', state: 'UT' },
      { first: 'Jane', last: 'Doe', state: 'UT' },
    ])
  })

  it('updates hook before::create with new item returned', () => {
    transformData((item: any) => ({ ...item, state: 'UT' }))(hookBefore)
    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('returns a promise that contains context', async () => {
    const promise = transformData(async (item: any) => {
      item.state = 'UT'
    })(hookBefore)

    assert.ok(promise instanceof Promise)

    const result = await promise

    assert.deepEqual(result, hookBefore)
  })

  it('updates hook before::create with new item returned', async () => {
    transformData((item: any) => ({
      ...item,
      state: 'UT',
    }))(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create async', async () => {
    await transformData((item) => {
      item.state = 'UT'
    })(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })

  it('updates hook before::create async with new item returned', async () => {
    await transformData((item: any) =>
      Promise.resolve({
        ...item,
        state: 'UT',
      }),
    )(hookBefore)

    assert.deepEqual(hookBefore.data, {
      first: 'John',
      last: 'Doe',
      state: 'UT',
    })
  })
})
