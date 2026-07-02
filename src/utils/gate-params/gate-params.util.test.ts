import { describe, it, expect, vi } from 'vitest'
import _omit from 'lodash/omit.js'
import { gateParams } from './gate-params.util.js'

describe('gateParams', () => {
  it('rule true includes the value as-is', () => {
    const params = { user: { id: 5 } } as any
    expect(gateParams(params, { user: true })).toEqual({ user: { id: 5 } })
  })

  it('rule false drops the key', () => {
    const params = { query: { a: 1 }, paginate: false } as any
    expect(gateParams(params, { query: true, paginate: false })).toEqual({
      query: { a: 1 },
    })
  })

  it('function returning true includes as-is', () => {
    const params = { query: { a: 1 } } as any
    expect(gateParams(params, { query: () => true })).toEqual({
      query: { a: 1 },
    })
  })

  it('function returning false or undefined drops the key', () => {
    const params = { a: 1, b: 2 } as any
    expect(gateParams(params, { a: () => false, b: () => undefined })).toEqual(
      {},
    )
  })

  it('function return value is used as a projection', () => {
    const params = { user: { id: 5, name: 'John' } } as any
    expect(gateParams(params, { user: (u) => u?.id })).toEqual({ user: 5 })
  })

  it('picks a nested value via dot-notation path', () => {
    const params = { user: { id: 5, updatedAt: 123 } } as any
    expect(gateParams(params, { 'user.id': true })).toEqual({ user: { id: 5 } })
  })

  it('skips a schema path that is absent from params (no injection)', () => {
    const params = { query: {} } as any
    expect(gateParams(params, { query: true, 'user.id': true })).toEqual({
      query: {},
    })
  })

  it('does not inject a top-level schema key absent from params', () => {
    const params = { query: {} } as any
    expect(gateParams(params, { query: true, user: true })).toEqual({
      query: {},
    })
  })

  it('drops a nested key while keeping the parent via a projection', () => {
    const params = { query: { userId: 1, _$client: { foo: 1 } } } as any
    expect(gateParams(params, { query: (q) => _omit(q, '_$client') })).toEqual({
      query: { userId: 1 },
    })
  })

  it('includes query by default when the schema omits it', () => {
    const params = { query: { a: 1 } } as any
    expect(gateParams(params, {})).toEqual({ query: { a: 1 } })
  })

  it('does not include query by default when the schema sets it to false', () => {
    const params = { query: { a: 1 } } as any
    expect(gateParams(params, { query: false })).toEqual({})
  })

  it('does not default the whole query when a nested query path is declared', () => {
    const params = { query: { a: 1, b: 2 } } as any
    expect(gateParams(params, { 'query.a': true })).toEqual({ query: { a: 1 } })
  })

  it('keeps unknown keys by default', () => {
    const params = { query: {}, foo: 1 } as any
    expect(gateParams(params, {})).toEqual({ query: {}, foo: 1 })
  })

  it('drops unknown keys with dropUnknownParams: true', () => {
    const params = { query: {}, foo: 1 } as any
    expect(
      gateParams(params, { 'user.id': true }, { dropUnknownParams: true }),
    ).toEqual({ query: {} })
  })

  it('keeps unknown keys except the ones the schema drops with false', () => {
    const params = { query: {}, foo: 1, rateLimit: { remaining: 9 } } as any
    expect(gateParams(params, { rateLimit: false })).toEqual({
      query: {},
      foo: 1,
    })
  })

  it('does not report a nested path root as unknown', () => {
    const params = { query: {}, user: { id: 5, updatedAt: 1 } } as any
    const onUnknownParams = vi.fn()

    const out = gateParams(
      params,
      { query: true, 'user.id': true },
      { onUnknownParams },
    )

    // `user` is claimed by the `user.id` path, so it must not be reported unknown
    expect(onUnknownParams).not.toHaveBeenCalled()
    expect(out).toEqual({ query: {}, user: { id: 5 } })
  })

  it('reports unknown keys once via onUnknownParams, excluding schema-false keys', () => {
    const params = { query: {}, rateLimit: { r: 1 }, mystery: 2 } as any
    const onUnknownParams = vi.fn()

    gateParams(params, { query: true, rateLimit: false }, { onUnknownParams })

    expect(onUnknownParams).toHaveBeenCalledTimes(1)
    expect(onUnknownParams).toHaveBeenCalledWith(['mystery'], params)
  })

  it('does not mutate params or nested objects', () => {
    const params = { query: { a: 1 }, provider: 'rest', foo: 1 } as any
    const snapshot = structuredClone(params)

    gateParams(params, { query: true, foo: false })
    gateParams(params, { 'query.a': true })

    expect(params).toEqual(snapshot)
  })

  it('never writes to the input params (deep-frozen, all code paths)', () => {
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze)
        Object.freeze(value)
      }
      return value
    }

    // A frozen object throws on any write attempt in strict mode (ESM), so if
    // gateParams tried to mutate params or any nested object this would throw.
    const params = deepFreeze({
      query: { name: 'John', $or: [{ a: 1 }, { b: 2 }] },
      user: { id: 7, updatedAt: 123 },
      provider: 'rest',
      rateLimit: { remaining: 9 },
      foo: 1,
    } as any)

    const onUnknownParams = vi.fn()

    // nested pick + false-drop + keep-default + observer
    expect(
      gateParams(
        params,
        { 'user.id': true, rateLimit: false },
        { onUnknownParams },
      ),
    ).toEqual({
      query: { name: 'John', $or: [{ a: 1 }, { b: 2 }] },
      user: { id: 7 },
      provider: 'rest',
      foo: 1,
    })

    // projection + dropUnknownParams (whitelist)
    expect(
      gateParams(params, { user: (u) => u.id }, { dropUnknownParams: true }),
    ).toEqual({
      query: { name: 'John', $or: [{ a: 1 }, { b: 2 }] },
      user: 7,
    })

    expect(onUnknownParams).toHaveBeenCalledWith(['provider', 'foo'], params)
  })
})
