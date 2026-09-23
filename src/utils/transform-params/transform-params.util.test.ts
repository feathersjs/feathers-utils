import { describe, it, expect } from 'vitest'
import { transformParams } from './transform-params.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('transformParams', () => {
  it('returns the original params when no fn is provided', () => {
    const params = { query: { a: 1 } }
    expect(transformParams(params, undefined)).toBe(params)
  })

  it('returns the transformed params', () => {
    const params = { provider: 'rest', query: { a: 1 } } as any
    const out = transformParams(params, (p) => {
      delete p.provider
      return p
    })
    expect(out).toEqual({ query: { a: 1 } })
  })

  it('passes a shallow copy to the fn (top-level not mutated)', async () => {
    const params = await expectNoSideEffects(
      { provider: 'rest', query: { a: 1 } },
      (params) =>
        transformParams(params, (p: any) => {
          delete p.provider
          return p
        }),
    )
    expect(params).toEqual({ query: { a: 1 } })
  })

  it('falls back to the original params when fn returns void', () => {
    const params = { query: { a: 1 } }
    const out = transformParams(params, () => undefined)
    expect(out).toBe(params)
  })
})
