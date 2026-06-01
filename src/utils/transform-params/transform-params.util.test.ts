import { describe, it, expect } from 'vitest'
import { transformParams } from './transform-params.util.js'

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

  it('passes a shallow copy to the fn (top-level not mutated)', () => {
    const params = { provider: 'rest', query: { a: 1 } } as any
    transformParams(params, (p) => {
      delete p.provider
      return p
    })
    // original top-level keys are untouched
    expect(params.provider).toBe('rest')
  })

  it('falls back to the original params when fn returns void', () => {
    const params = { query: { a: 1 } }
    const out = transformParams(params, () => undefined)
    expect(out).toBe(params)
  })
})
