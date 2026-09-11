import { isContext } from './is-context.predicate.js'

describe('isContext', () => {
  it('returns correct for path', () => {
    expect(isContext({ path: 'users' })({ path: 'users' })).toBe(true)
    expect(isContext({ path: ['users', 'posts'] })({ path: 'users' })).toBe(
      true,
    )

    expect(isContext({ path: 'users' })({ path: 'posts' })).toBe(false)
  })

  it('matches path exactly, not as a substring', () => {
    // 'user' must NOT match 'users' / 'admin-users' / 'user-settings'
    expect(isContext({ path: 'user' })({ path: 'users' })).toBe(false)
    expect(isContext({ path: 'user' })({ path: 'admin-users' })).toBe(false)
    expect(isContext({ path: 'order' })({ path: 'orders-archive' })).toBe(false)
    expect(isContext({ path: 'user' })({ path: 'user' })).toBe(true)
  })

  it('returns true for type', () => {
    expect(isContext({ type: 'before' })({ type: 'before' })).toBe(true)
    expect(isContext({ type: ['before', 'after'] })({ type: 'before' })).toBe(
      true,
    )

    expect(isContext({ type: 'before' })({ type: 'after' })).toBe(false)
  })

  it('returns true for method', () => {
    expect(isContext({ method: 'create' })({ method: 'create' })).toBe(true)
    expect(
      isContext({ method: ['create', 'update'] })({ method: 'create' }),
    ).toBe(true)

    expect(isContext({ method: 'create' })({ method: 'remove' })).toBe(false)
  })

  it('returns correct for id', () => {
    expect(isContext({ id: 1 })({ id: 1 })).toBe(true)
    expect(isContext({ id: [1, 2] })({ id: 2 })).toBe(true)

    expect(isContext({ id: 1 })({ id: 2 })).toBe(false)
    expect(isContext({ id: 1 })({})).toBe(false)
  })

  it("compares ids strictly, so `1` is not `'1'`", () => {
    expect(isContext({ id: 1 })({ id: '1' })).toBe(false)
    expect(isContext({ id: '1' })({ id: 1 })).toBe(false)
  })

  it('matches the multi variants with `id: null`', () => {
    expect(isContext({ id: null })({ id: null })).toBe(true)
    expect(isContext({ id: [1, null] })({ id: null })).toBe(true)

    expect(isContext({ id: null })({ id: 1 })).toBe(false)
    // an absent id is not the same as a null one
    expect(isContext({ id: null })({})).toBe(false)
  })

  it('treats an omitted id as no criterion at all', () => {
    expect(isContext({})({ id: 1 })).toBe(true)
    expect(isContext({ id: undefined })({ id: 1 })).toBe(true)
    expect(isContext({ id: undefined })({})).toBe(true)
  })

  it('combines all options', () => {
    expect(
      isContext({ path: 'users', type: 'before', method: 'create' })({
        path: 'users',
        type: 'before',
        method: 'create',
      }),
    ).toBe(true)

    expect(
      isContext({ path: 'users', type: 'before', method: 'create' })({
        path: 'users',
        type: 'before',
        method: 'remove',
      }),
    ).toBe(false)

    expect(
      isContext({ path: 'users', type: 'before', method: 'create' })({
        path: 'users',
        type: 'after',
        method: 'create',
      }),
    ).toBe(false)

    expect(
      isContext({ path: 'users', type: 'before', method: 'create' })({
        path: 'posts',
        type: 'before',
        method: 'create',
      }),
    ).toBe(false)
  })
})
