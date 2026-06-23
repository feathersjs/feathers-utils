import assert from 'node:assert'
import { expectTypeOf } from 'vitest'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { stashable } from './stashable.hook.js'
import type { StashOptions } from '../../utils/stash/stash.util.js'

function mock(
  cb: any,
  hookName: string,
  options?: Partial<StashOptions>,
  beforeHook?: any,
  afterHook?: any,
) {
  const app = feathers()
  app.use('/test', new MemoryService({ multi: true }))
  const service = app.service('test')
  const hook = stashable(cb, options)

  const beforeAll = [hook]
  if (beforeHook) {
    beforeAll.push(beforeHook)
  }

  const afterAll = [hook]
  if (afterHook) {
    afterAll.push(afterHook)
  }

  service.hooks({
    before: {
      [hookName]: beforeAll,
    },
    after: {
      [hookName]: afterAll,
    },
  })

  return {
    app,
    service,
  }
}

function mockAround(
  cb: any,
  hookName: string,
  options?: Partial<StashOptions>,
) {
  const app = feathers()
  app.use('/test', new MemoryService({ multi: true }))
  const service = app.service('test')
  const hook = stashable(cb, options)

  service.hooks({
    around: {
      [hookName]: [hook],
    },
  })

  return {
    app,
    service,
  }
}

describe('hook - stashable (before/after)', function () {
  describe('create', function () {
    it('basic create', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.strictEqual(byId['0'].before, undefined, 'before is undefined')
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: true, comment: 'awesome' },
          'has right item',
        )
      }

      const { service } = mock(cb, 'create')
      assert.ok(!calledCb, 'not called cb')

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(
        item,
        { id: 0, test: true, comment: 'awesome' },
        'has right result',
      )
    })
  })

  describe('update', function () {
    it('basic update', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false },
          'has right item',
        )
      }

      const { service } = mock(cb, 'update', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.update(item.id, { test: false })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0, test: false }, 'has right result')
    })

    it('basic update with $select', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false },
          'has right item',
        )
      }
      const { service } = mock(cb, 'update', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.update(
        item.id,
        { test: false },
        { query: { $select: ['id'] } },
      )

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0 }, 'has right result')
    })
  })

  describe('patch', function () {
    it('basic patch', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false, comment: 'awesome' },
          'has right item',
        )
      }
      const { service } = mock(cb, 'patch', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.patch(item.id, { test: false })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(
        result,
        { id: 0, test: false, comment: 'awesome' },
        'has right result',
      )
    })

    it('basic patch with $select', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false, comment: 'awesome' },
          'has right item',
        )
      }
      const { service } = mock(cb, 'patch', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.patch(
        item.id,
        { test: false },
        { query: { $select: ['id'] } },
      )

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0 }, 'has right result')
    })
  })

  describe('remove', function () {
    it('basic remove', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: true, comment: 'awesome' },
          'has right item',
        )
      }

      const { service } = mock(cb, 'remove', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      await service.remove(item.id)

      assert.ok(calledCb, 'called cb')
    })
  })
})

describe('hook - stashable (around)', function () {
  describe('create', function () {
    it('basic create', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.strictEqual(byId['0'].before, undefined, 'before is undefined')
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: true, comment: 'awesome' },
          'has right item',
        )
      }

      const { service } = mockAround(cb, 'create')
      assert.ok(!calledCb, 'not called cb')

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(
        item,
        { id: 0, test: true, comment: 'awesome' },
        'has right result',
      )
    })
  })

  describe('update', function () {
    it('basic update', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false },
          'has right item',
        )
      }

      const { service } = mockAround(cb, 'update', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.update(item.id, { test: false })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0, test: false }, 'has right result')
    })

    it('basic update with $select', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false },
          'has right item',
        )
      }
      const { service } = mockAround(cb, 'update', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.update(
        item.id,
        { test: false },
        { query: { $select: ['id'] } },
      )

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0 }, 'has right result')
    })
  })

  describe('patch', function () {
    it('basic patch', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false, comment: 'awesome' },
          'has right item',
        )
      }
      const { service } = mockAround(cb, 'patch', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.patch(item.id, { test: false })

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(
        result,
        { id: 0, test: false, comment: 'awesome' },
        'has right result',
      )
    })

    it('basic patch with $select', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: false, comment: 'awesome' },
          'has right item',
        )
      }
      const { service } = mockAround(cb, 'patch', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      const result = await service.patch(
        item.id,
        { test: false },
        { query: { $select: ['id'] } },
      )

      assert.ok(calledCb, 'called cb')
      assert.deepStrictEqual(result, { id: 0 }, 'has right result')
    })
  })

  describe('remove', function () {
    it('basic remove', async function () {
      let calledCb = false
      const cb = (byId: any, context: any) => {
        calledCb = true
        assert.strictEqual(context.path, 'test', 'cb has context')
        assert.deepStrictEqual(
          byId['0'].before,
          { id: 0, test: true, comment: 'awesome' },
          'has right before',
        )
        assert.deepStrictEqual(
          byId['0'].item,
          { id: 0, test: true, comment: 'awesome' },
          'has right item',
        )
      }

      const { service } = mockAround(cb, 'remove', { fetchBefore: true })

      const item = await service.create({ test: true, comment: 'awesome' })

      assert.ok(!calledCb, 'not called cb')

      await service.remove(item.id)

      assert.ok(calledCb, 'called cb')
    })
  })
})

describe('hook - stashable (multi & options)', function () {
  it('skips when shouldSkip("checkMulti") matches', async function () {
    let calledCb = false
    const cb = () => {
      calledCb = true
    }

    const { service } = mock(cb, 'patch', { fetchBefore: true })

    const item = await service.create({ test: true })
    await service.patch(item.id, { test: false }, {
      skipHooks: ['checkMulti'],
    } as any)

    assert.ok(!calledCb, 'cb is not called when skipped')
  })

  it('uses _find when skipHooks is true (multi)', async function () {
    let byId: any
    const cb = (changes: any) => {
      byId = changes
    }

    const { service } = mock(cb, 'patch', {
      fetchBefore: true,
      skipHooks: true,
    })

    const item0 = await service.create({ test: true })
    const item1 = await service.create({ test: true })

    await service.patch(null, { test: false }, { query: {} })

    assert.strictEqual(byId[item0.id].before.test, true, 'item0 before')
    assert.strictEqual(byId[item1.id].item.test, false, 'item1 item')
  })

  it('respects deleteParams when (re)fetching', async function () {
    let byId: any
    const cb = (changes: any) => {
      byId = changes
    }

    const { service } = mock(cb, 'patch', {
      fetchBefore: true,
      deleteParams: ['foo'],
    })

    const item = await service.create({ test: true, comment: 'awesome' })

    await service.patch(item.id, { test: false }, { foo: 'bar' } as any)

    assert.deepStrictEqual(
      byId[item.id].before,
      { id: item.id, test: true, comment: 'awesome' },
      'has right before',
    )
    assert.strictEqual(byId[item.id].item.test, false, 'has right item')
  })

  it('multi patch with fetchBefore tracks all affected items', async function () {
    let byId: any
    const cb = (changes: any) => {
      byId = changes
    }

    const { service } = mock(cb, 'patch', { fetchBefore: true })

    const item0 = await service.create({ test: true })
    const item1 = await service.create({ test: true })

    await service.patch(null, { test: false }, { query: {} })

    assert.deepStrictEqual(
      byId[item0.id].before,
      { id: item0.id, test: true },
      'item0 before',
    )
    assert.deepStrictEqual(
      byId[item0.id].item,
      { id: item0.id, test: false },
      'item0 item',
    )
    assert.deepStrictEqual(
      byId[item1.id].before,
      { id: item1.id, test: true },
      'item1 before',
    )
    assert.deepStrictEqual(
      byId[item1.id].item,
      { id: item1.id, test: false },
      'item1 item',
    )
  })

  it('supports a params function and a custom (array) name', async function () {
    let byId: any
    let manipulated = false
    const cb = (changes: any) => {
      byId = changes
    }

    const { service } = mock(cb, 'patch', {
      fetchBefore: true,
      name: ['custom', 'nested'],
      params: (params: any) => {
        manipulated = true
        return params
      },
    })

    const item = await service.create({ test: true, comment: 'awesome' })

    await service.patch(item.id, { test: false })

    assert.ok(manipulated, 'params function was called')
    assert.deepStrictEqual(
      byId[item.id].before,
      { id: item.id, test: true, comment: 'awesome' },
      'has right before',
    )
    assert.strictEqual(byId[item.id].item.test, false, 'has right item')
  })

  it('works without a callback and stores the result on context.params.stash', async function () {
    let stash: any
    const { service } = mock(
      undefined,
      'patch',
      { fetchBefore: true },
      null,
      (context: any) => {
        stash = context.params.stash
      },
    )

    const item = await service.create({ test: true, comment: 'awesome' })

    await service.patch(item.id, { test: false })

    assert.deepStrictEqual(
      stash[item.id].before,
      { id: item.id, test: true, comment: 'awesome' },
      'context.params.stash has right before',
    )
    assert.strictEqual(stash[item.id].item.test, false, 'has right item')
  })

  it('supports a custom (string) name', async function () {
    let stash: any
    const { service } = mock(
      undefined,
      'patch',
      {
        fetchBefore: true,
        name: 'changes',
      },
      null,
      (context: any) => {
        stash = context.params.changes
      },
    )

    const item = await service.create({ test: true, comment: 'awesome' })

    await service.patch(item.id, { test: false })

    assert.deepStrictEqual(
      stash[item.id].before,
      { id: item.id, test: true, comment: 'awesome' },
      'context.params.changes has right before',
    )
    assert.strictEqual(stash[item.id].item.test, false, 'has right item')
  })

  it('is type-compatible with AroundHookFunction', () => {
    type Item = { id: number; name: string }
    type Services = { items: MemoryService<Item> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Item>>

    expectTypeOf(stashable<Ctx>()).toExtend<
      AroundHookFunction<App, MemoryService<Item>>
    >()
  })
})
