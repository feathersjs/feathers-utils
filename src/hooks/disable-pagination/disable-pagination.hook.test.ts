import { assert } from 'vitest'
import { disablePagination } from './disable-pagination.hook.js'
import type { HookContext } from '@feathersjs/feathers'

describe('hook - disablePagination', () => {
  it('disables on $limit = -1', () => {
    const result: any = disablePagination()({
      type: 'before',
      method: 'find',
      params: { query: { id: 1, $limit: -1 } },
    } as HookContext)
    assert.deepEqual(result.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = "-1"', () => {
    const result: any = disablePagination()({
      type: 'before',
      method: 'find',
      params: { query: { id: 1, $limit: '-1' } },
    } as HookContext)
    assert.deepEqual(result.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = -1 in around', () => {
    const result: any = disablePagination()({
      type: 'around',
      method: 'find',
      params: { query: { id: 1, $limit: -1 } },
    } as HookContext)
    assert.deepEqual(result.params, { paginate: false, query: { id: 1 } })
  })

  it('disables on $limit = "-1" in around', () => {
    const result: any = disablePagination()({
      type: 'around',
      method: 'find',
      params: { query: { id: 1, $limit: '-1' } },
    } as HookContext)
    assert.deepEqual(result.params, { paginate: false, query: { id: 1 } })
  })

  it('throws if after hook', () => {
    assert.throws(() => {
      disablePagination()({
        type: 'after',
        method: 'find',
        params: { query: { id: 1, $limit: -1 } },
      } as HookContext)
    })
  })

  it('throws if not find', () => {
    assert.throws(() => {
      disablePagination()({
        type: 'before',
        method: 'get',
        params: { query: { id: 1, $limit: -1 } },
      } as HookContext)
    })
  })
})
