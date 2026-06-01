import { describe, it, expect } from 'vitest'
import { stableStringify } from './cache-utils.js'

describe('stableStringify', () => {
  it('is order-independent for top-level keys', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(
      stableStringify({ b: 2, a: 1 }),
    )
  })

  it('is order-independent for query keys', () => {
    const a = stableStringify({ query: { name: 'John', age: 30 } })
    const b = stableStringify({ query: { age: 30, name: 'John' } })
    expect(a).toBe(b)
  })

  it('normalizes $or array order', () => {
    const a = stableStringify({
      query: { $or: [{ name: 'John' }, { name: 'Jane' }] },
    })
    const b = stableStringify({
      query: { $or: [{ name: 'Jane' }, { name: 'John' }] },
    })
    expect(a).toBe(b)
  })

  it('normalizes $in array order', () => {
    const a = stableStringify({ query: { name: { $in: ['John', 'Jane'] } } })
    const b = stableStringify({ query: { name: { $in: ['Jane', 'John'] } } })
    expect(a).toBe(b)
  })

  it('distinguishes different queries', () => {
    expect(stableStringify({ query: { name: 'John' } })).not.toBe(
      stableStringify({ query: { name: 'Jane' } }),
    )
  })

  it('handles params without a query', () => {
    expect(() =>
      stableStringify({ provider: 'rest', authenticated: true }),
    ).not.toThrow()
    expect(stableStringify({ provider: 'rest' })).toBe(
      stableStringify({ provider: 'rest' }),
    )
  })

  it('throws on non-JSON (function) param values', () => {
    expect(() => stableStringify({ fn: () => 1 })).toThrow(
      'Cannot stringify non JSON value',
    )
  })

  it('produces a deterministic string for nested objects', () => {
    const a = stableStringify({
      query: { user: { id: 1, role: 'admin' }, age: { $gt: 18 } },
    })
    const b = stableStringify({
      query: { age: { $gt: 18 }, user: { role: 'admin', id: 1 } },
    })
    expect(a).toBe(b)
  })
})
