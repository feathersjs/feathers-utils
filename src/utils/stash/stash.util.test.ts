import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import {
  stash,
  stashBefore,
  stashAfter,
  getOrFindByIdParams,
} from './stash.util.js'
import type { StashOptions } from './stash.util.js'

function mock(options?: Partial<StashOptions>) {
  const app = feathers()
  app.use('test', new MemoryService({ multi: true }))
  const service = app.service('test')

  let afterStash: any
  let afterParamsStash: any

  service.hooks({
    before: {
      all: [
        async (context: any) => {
          await stash(context, options)
          return context
        },
      ],
    },
    after: {
      all: [
        async (context: any) => {
          afterStash = await stash(context, options)
          afterParamsStash = context.params.stash
          return context
        },
      ],
    },
  })

  return {
    service,
    getAfterStash: () => afterStash,
    getAfterParamsStash: () => afterParamsStash,
  }
}

describe('util - stash', function () {
  it('writes the changes to context.params.stash and returns them (patch)', async function () {
    const { service, getAfterStash, getAfterParamsStash } = mock({
      fetchBefore: true,
    })

    const item = await service.create({ test: true, comment: 'awesome' })

    await service.patch(item.id, { test: false })

    const afterStash = getAfterStash()

    assert.deepStrictEqual(
      afterStash[item.id].before,
      { id: item.id, test: true, comment: 'awesome' },
      'returned stash has right before',
    )
    assert.strictEqual(afterStash[item.id].item.test, false, 'has right item')
    assert.deepStrictEqual(
      getAfterParamsStash(),
      afterStash,
      'context.params.stash equals the returned stash',
    )
  })

  it('before is undefined on create', async function () {
    const { service, getAfterStash } = mock()

    const item = await service.create({ test: true, comment: 'awesome' })

    const afterStash = getAfterStash()

    assert.strictEqual(
      afterStash[item.id].before,
      undefined,
      'before undefined',
    )
    assert.deepStrictEqual(
      afterStash[item.id].item,
      { id: item.id, test: true, comment: 'awesome' },
      'has right item',
    )
  })

  it('tracks all affected items on multi patch', async function () {
    const { service, getAfterStash } = mock({ fetchBefore: true })

    const item0 = await service.create({ test: true })
    const item1 = await service.create({ test: true })

    await service.patch(null, { test: false }, { query: {} })

    const afterStash = getAfterStash()

    assert.strictEqual(afterStash[item0.id].before.test, true, 'item0 before')
    assert.strictEqual(afterStash[item0.id].item.test, false, 'item0 item')
    assert.strictEqual(afterStash[item1.id].before.test, true, 'item1 before')
    assert.strictEqual(afterStash[item1.id].item.test, false, 'item1 item')
  })

  it('stashBefore stores itemsBefore on context.params.<name>.itemsBefore', async function () {
    const app = feathers()
    app.use('test', new MemoryService({ multi: true }))
    const service = app.service('test')

    const item = await service.create({ test: true, comment: 'awesome' })

    const context: any = {
      id: item.id,
      method: 'patch',
      type: 'before',
      service,
      params: {},
    }

    const itemsBefore = await stashBefore(context, { fetchBefore: true })

    assert.deepStrictEqual(
      itemsBefore[item.id],
      { id: item.id, test: true, comment: 'awesome' },
      'stashBefore returns itemsBefore by id',
    )
    assert.deepStrictEqual(
      context.params.stash.itemsBefore,
      itemsBefore,
      'stored at context.params.stash.itemsBefore',
    )
  })

  it('stashAfter returns undefined when no before-phase ran', async function () {
    const app = feathers()
    app.use('test', new MemoryService({ multi: true }))
    const service = app.service('test')

    const item = await service.create({ test: true })

    const context: any = {
      id: item.id,
      method: 'patch',
      type: 'after',
      service,
      params: {},
      result: { id: item.id, test: false },
    }

    const result = await stashAfter(context)

    assert.strictEqual(result, undefined, 'no itemsBefore -> undefined')
  })

  it('reuses context.result in the after-phase when params are unchanged (no refetch)', async function () {
    const app = feathers()
    app.use('test', new MemoryService({ multi: true }))
    const service = app.service('test')

    const item = await service.create({ test: true, comment: 'awesome' })

    let getCalls = 0
    const origGet = service.get.bind(service)
    ;(service as any).get = (id: any, params: any) => {
      getCalls++
      return origGet(id, params)
    }

    // a params fn (returning params unchanged) forces getOrFindByIdParams to
    // build params in the after-phase; the deepEqual optimization must then
    // detect they match the current request params and skip the refetch.
    const options = { fetchBefore: true, params: (p: any) => p }
    service.hooks({
      before: {
        patch: [
          async (context: any) => {
            await stash(context, options)
            return context
          },
        ],
      },
      after: {
        patch: [
          async (context: any) => {
            await stash(context, options)
            return context
          },
        ],
      },
    })

    await service.patch(item.id, { test: false })

    assert.strictEqual(
      getCalls,
      1,
      'only the before-phase fetched; the after-phase reused context.result',
    )
  })

  describe('getOrFindByIdParams', function () {
    it('builds params for multi before, stripping stash and $select', async function () {
      const app = feathers()
      app.use('test', new MemoryService({ multi: true }))
      const service = app.service('test')

      const context: any = {
        id: null,
        method: 'patch',
        type: 'before',
        service,
        params: { query: { test: true, $select: ['id'] }, stash: { foo: 1 } },
      }

      const params = await getOrFindByIdParams(context, {
        type: 'before',
        skipHooks: false,
        deleteParams: [],
      })

      assert.strictEqual(params?.paginate, false, 'paginate disabled')
      assert.strictEqual((params as any)?.stash, undefined, 'stash removed')
      assert.strictEqual(params?.query?.$select, undefined, '$select removed')
      assert.strictEqual(params?.query?.test, true, 'keeps other query')
    })

    it('returns undefined for after when no params fn and no $select', async function () {
      const app = feathers()
      app.use('test', new MemoryService({ multi: true }))
      const service = app.service('test')

      const context: any = {
        id: 1,
        method: 'patch',
        type: 'after',
        service,
        params: { query: {} },
      }

      const params = await getOrFindByIdParams(context, {
        type: 'after',
        skipHooks: false,
        deleteParams: [],
      })

      assert.strictEqual(params, undefined)
    })
  })
})
