import { isContext } from './is-context.predicate.js'

describe('isContext', () => {
  it('returns correct for path', () => {
    expect(isContext({ path: 'users' })({ path: 'users' })).toBe(true)
    expect(isContext({ path: ['users', 'posts'] })({ path: 'users' })).toBe(
      true,
    )

    expect(isContext({ path: 'users' })({ path: 'posts' })).toBe(false)
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
