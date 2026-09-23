import type { HookContext } from '@feathersjs/feathers'
import { getPaginate } from './get-paginate.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('getPaginate', () => {
  it('returns service.options.paginate', function () {
    const serviceOptions = {
      paginate: {
        default: 10,
        max: 50,
      },
    }

    const paginate = getPaginate({
      params: {},
      service: {
        options: serviceOptions,
      },
    } as HookContext)

    assert.deepStrictEqual(paginate, { default: 10, max: 50 })
  })

  it('returns undefined for params.paginate: false', function () {
    const serviceOptions = {
      paginate: {
        default: 10,
        max: 50,
      },
    }

    const paginate = getPaginate({
      params: { paginate: false },
      service: {
        options: serviceOptions,
      },
    } as HookContext)

    assert.deepStrictEqual(paginate, undefined)
  })

  it('returns context.adapter.paginate over service.options.paginate', function () {
    const serviceOptions = {
      paginate: {
        default: 10,
        max: 50,
      },
    }

    const paginate = getPaginate({
      params: { adapter: { paginate: { default: 20, max: 100 } } },
      service: {
        options: serviceOptions,
      },
    } as HookContext)

    assert.deepStrictEqual(paginate, { default: 20, max: 100 })
  })

  it('returns undefined for no paginate', function () {
    const serviceOptions = {
      paginate: false,
    }

    const paginate = getPaginate({
      params: {},
      service: {
        options: serviceOptions,
      },
    } as HookContext)

    assert.deepStrictEqual(paginate, undefined)
  })

  it('does not mutate params', async () => {
    await expectNoSideEffects(
      { query: { name: 'Jane' }, adapter: { paginate: { default: 5 } } },
      (params) =>
        getPaginate({
          params,
          service: { options: { paginate: { default: 10 } } },
        } as any),
    )
  })
})
