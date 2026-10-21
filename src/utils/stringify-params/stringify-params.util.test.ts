import { describe, it, expect } from 'vitest'
import safeStringify from 'safe-stable-stringify'
import { normalize } from '../sort-query-properties/normalize.js'
import { stringifyParams } from './stringify-params.util.js'
import { expectNoSideEffects } from '../../testing/index.js'

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

  it('does not mutate the original params (order preserved)', async () => {
    await expectNoSideEffects(
      {
        query: {
          $or: [{ name: 'John' }, { name: 'Jane' }],
          status: { $in: [3, 1, 2] },
          tags: ['b', 'a', 'c'],
        },
      },
      (params) => stringifyParams(params),
    )
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

  // sequelize uses symbols as operators - registered ones, `Symbol.for('gt')`
  describe('symbol keys', () => {
    const gt = Symbol.for('gt')
    const lt = Symbol.for('lt')

    it('tells queries apart that differ only in a symbol operator', () => {
      expect(stringifyParams({ query: { age: { [gt]: 18 } } })).not.toBe(
        stringifyParams({ query: { age: { [lt]: 18 } } }),
      )
    })

    it('tells queries apart that differ only in a symbol key at the top', () => {
      const or = Symbol.for('or')
      expect(stringifyParams({ query: { [or]: [{ a: 1 }] } })).not.toBe(
        stringifyParams({ query: { [or]: [{ a: 2 }] } }),
      )
    })

    it('is order-independent for symbol keys', () => {
      expect(stringifyParams({ query: { age: { [gt]: 18, [lt]: 65 } } })).toBe(
        stringifyParams({ query: { age: { [lt]: 65, [gt]: 18 } } }),
      )
    })

    it('serializes a registered symbol the same in every process', () => {
      expect(stringifyParams({ query: { age: { [gt]: 18 } } })).toBe(
        '{"query":{"age":{"Symbol.for(gt)":18}}}',
      )
    })

    it('tells a registered symbol apart from one with the same description', () => {
      expect(stringifyParams({ query: { age: { [gt]: 18 } } })).not.toBe(
        stringifyParams({ query: { age: { [Symbol('gt')]: 18 } } }),
      )
    })
  })

  // `JSON.stringify` is only used where it prints what `safeStringify` would
  describe('fast path', () => {
    const reference = (params: any) =>
      safeStringify(normalize(params, { encodeSymbols: true })) ?? ''

    class Unsorted {
      b = 1
      a = 2
    }
    class ObjectId {
      constructor(private hex: string) {}
      toJSON() {
        return this.hex
      }
    }
    const cyclic: any = { query: { a: 1 } }
    cyclic.query.self = cyclic.query

    it.each([
      ['plain', { query: { b: 1, a: { $in: [3, 1, 2] } }, provider: 'rest' }],
      [
        'strings to escape',
        { query: { a: 'q"u\\o\nte', b: '\ud800', c: 'ü' } },
      ],
      ['special numbers', { query: { a: NaN, b: -0, c: Infinity, d: 1e21 } }],
      [
        'undefined and functions',
        { query: { a: undefined, b: [undefined], c: () => 1 } },
      ],
      ['dates', { query: { a: new Date(0), b: new Date(Number.NaN) } }],
      ['a class instance', { query: { a: new Unsorted() } }],
      ['an ObjectId', { query: { _id: new ObjectId('a1') } }],
      ['a toJSON key', { query: { a: { toJSON: () => ({ b: 1, a: 2 }) } } }],
      ['a BigInt', { query: { a: 1n } }],
      ['a cycle', cyclic],
      ['symbol keys', { query: { [Symbol.for('or')]: [{ a: 1 }], b: 1 } }],
      ['integer-like keys', { query: { 10: 'a', 2: 'b', $limit: 1, a: 1 } }],
      ['a key starting with a digit', { query: { '1a': 1, $b: 2, '01': 3 } }],
      ['a __proto__ key', JSON.parse('{"query":{"__proto__":{"a":1}}}')],
    ])('prints the same as safeStringify for %s', (_, params) => {
      expect(stringifyParams(params)).toBe(reference(params))
    })

    it('sorts $in elements like their safeStringify output', () => {
      const values = [10, 9, 'b', 'a', true, null, -0, 'a"b', NaN, { x: 1 }]
      const expected = values
        .map((v) => ({ k: safeStringify(v) ?? '', v }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
        .map((e) => e.v)

      expect(normalize({ $in: values }).$in).toStrictEqual(expected)
    })
  })
})
