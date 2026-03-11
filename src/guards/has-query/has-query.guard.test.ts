import type { Params } from '@feathersjs/feathers'
import { hasQuery } from './has-query.guard.js'

describe('guards/has-query', () => {
  it('returns true when query is present', () => {
    const params: Params = { query: { name: 'Dave' } }
    expect(hasQuery(params)).toBe(true)
  })

  it('returns false when query is undefined', () => {
    const params: Params = {}
    expect(hasQuery(params)).toBe(false)
  })

  it('returns false when query is null', () => {
    const params = { query: null } as unknown as Params
    expect(hasQuery(params)).toBe(false)
  })

  it('returns true for empty query object', () => {
    const params: Params = { query: {} }
    expect(hasQuery(params)).toBe(true)
  })
})
