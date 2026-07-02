import { describe, it, expect } from 'vitest'
import { stringifyParams } from './stringify-params.util.js'

describe('stringifyParams', () => {
  it('is order-independent for top-level keys', () => {
    expect(stringifyParams({ a: 1, b: 2 } as any)).toBe(
      stringifyParams({ b: 2, a: 1 } as any),
    )
  })

  it('is order-independent for query keys', () => {
    const a = stringifyParams({ query: { name: 'John', age: 30 } })
    const b = stringifyParams({ query: { age: 30, name: 'John' } })
    expect(a).toBe(b)
  })

  it('normalizes $or array order', () => {
    const a = stringifyParams({
      query: { $or: [{ name: 'John' }, { name: 'Jane' }] },
    })
    const b = stringifyParams({
      query: { $or: [{ name: 'Jane' }, { name: 'John' }] },
    })
    expect(a).toBe(b)
  })

  it('normalizes $in array order', () => {
    const a = stringifyParams({ query: { name: { $in: ['John', 'Jane'] } } })
    const b = stringifyParams({ query: { name: { $in: ['Jane', 'John'] } } })
    expect(a).toBe(b)
  })

  it('normalizes $nin array order', () => {
    const a = stringifyParams({ query: { status: { $nin: [3, 1, 2] } } })
    const b = stringifyParams({ query: { status: { $nin: [1, 2, 3] } } })
    expect(a).toBe(b)
  })

  it('normalizes a $in nested inside $and (recursively)', () => {
    const a = stringifyParams({
      query: {
        $and: [
          { status: { $in: ['active', 'pending'] } },
          { role: { $in: ['admin', 'user'] } },
        ],
      },
    })
    const b = stringifyParams({
      query: {
        $and: [
          { role: { $in: ['user', 'admin'] } },
          { status: { $in: ['pending', 'active'] } },
        ],
      },
    })
    // both the outer $and element order and the inner $in order are normalized
    expect(a).toBe(b)
  })

  it('normalizes a $in nested inside $or (recursively)', () => {
    const a = stringifyParams({
      query: { $or: [{ id: { $in: [3, 1, 2] } }, { name: 'John' }] },
    })
    const b = stringifyParams({
      query: { $or: [{ name: 'John' }, { id: { $in: [1, 2, 3] } }] },
    })
    expect(a).toBe(b)
  })

  it('does NOT sort order-significant arrays like $between', () => {
    const a = stringifyParams({ query: { age: { $between: [20, 30] } } as any })
    const b = stringifyParams({ query: { age: { $between: [30, 20] } } as any })
    // $between is not an order-independent operator -> order must be preserved
    expect(a).not.toBe(b)
  })

  it('does NOT sort plain (non-operator) array fields', () => {
    const a = stringifyParams({ query: { tags: ['b', 'a', 'c'] } as any })
    const b = stringifyParams({ query: { tags: ['a', 'b', 'c'] } as any })
    expect(a).not.toBe(b)
    // and the original order survives in the output
    expect(a).toContain('["b","a","c"]')
  })

  it('does NOT sort arrays nested in a JSON/data field value', () => {
    const a = stringifyParams({
      query: { settings: { order: [3, 1, 2] } } as any,
    })
    const b = stringifyParams({
      query: { settings: { order: [1, 2, 3] } } as any,
    })
    expect(a).not.toBe(b)
    expect(a).toContain('[3,1,2]')
  })

  it('does not mutate the original params (order preserved)', () => {
    const params = {
      query: {
        $or: [{ name: 'John' }, { name: 'Jane' }],
        status: { $in: [3, 1, 2] },
        tags: ['b', 'a', 'c'],
      },
    }
    const snapshot = structuredClone(params)

    stringifyParams(params)

    // input is left byte-for-byte identical, incl. all array orderings
    expect(params).toEqual(snapshot)
    expect(params.query.$or).toEqual([{ name: 'John' }, { name: 'Jane' }])
    expect(params.query.status.$in).toEqual([3, 1, 2])
    expect(params.query.tags).toEqual(['b', 'a', 'c'])
  })

  it('distinguishes different queries', () => {
    expect(stringifyParams({ query: { name: 'John' } })).not.toBe(
      stringifyParams({ query: { name: 'Jane' } }),
    )
  })

  it('handles params without a query', () => {
    expect(() =>
      stringifyParams({ provider: 'rest', authenticated: true } as any),
    ).not.toThrow()
    expect(stringifyParams({ provider: 'rest' })).toBe(
      stringifyParams({ provider: 'rest' }),
    )
  })

  it('produces a deterministic string for nested objects', () => {
    const a = stringifyParams({
      query: { user: { id: 1, role: 'admin' }, age: { $gt: 18 } },
    })
    const b = stringifyParams({
      query: { age: { $gt: 18 }, user: { role: 'admin', id: 1 } },
    })
    expect(a).toBe(b)
  })

  it('drops function-valued params instead of throwing', () => {
    expect(() => stringifyParams({ fn: () => 1 } as any)).not.toThrow()
    // the function key is omitted, like JSON.stringify does for object props
    expect(
      stringifyParams({ query: { name: 'John' }, fn: () => 1 } as any),
    ).toBe(stringifyParams({ query: { name: 'John' } }))
  })

  it('does not throw on circular references', () => {
    const circular: Record<string, any> = { query: { name: 'John' } }
    circular.self = circular
    expect(() => stringifyParams(circular)).not.toThrow()
    expect(stringifyParams(circular)).toContain('[Circular]')
  })

  it('distinguishes different Date values via toJSON', () => {
    const a = stringifyParams({ query: { createdAt: new Date('2020-01-01') } })
    const b = stringifyParams({ query: { createdAt: new Date('2024-01-01') } })
    expect(a).not.toBe(b)
  })

  it('produces the same key for equal Date values (different instances)', () => {
    const a = stringifyParams({ query: { createdAt: new Date('2020-01-01') } })
    const b = stringifyParams({ query: { createdAt: new Date('2020-01-01') } })
    expect(a).toBe(b)
  })

  it('serializes BigInt without throwing', () => {
    expect(() => stringifyParams({ query: { count: 10n } })).not.toThrow()
    expect(stringifyParams({ query: { count: 10n } })).toBe(
      stringifyParams({ query: { count: 10n } }),
    )
  })

  it('drops symbol values without throwing', () => {
    expect(() =>
      stringifyParams({ query: { name: 'John' }, sym: Symbol('x') } as any),
    ).not.toThrow()
    expect(
      stringifyParams({ query: { name: 'John' }, sym: Symbol('x') } as any),
    ).toBe(stringifyParams({ query: { name: 'John' } }))
  })
})
