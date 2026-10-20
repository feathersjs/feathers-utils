import { pickPaths } from './pick-paths.helper.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('pickPaths', () => {
  it('picks top-level keys', () => {
    expect(pickPaths({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({
      a: 1,
      c: 3,
    })
  })

  it('picks a nested path into a nested result', () => {
    expect(pickPaths({ id: 1, u: { e: 'x', n: 'y' } }, ['u.e'])).toEqual({
      u: { e: 'x' },
    })
    expect(pickPaths({ a: { b: { c: 1 } } }, ['a.b.c'])).toEqual({
      a: { b: { c: 1 } },
    })
  })

  it('rebuilds an array when the path runs through one', () => {
    expect(pickPaths({ list: [{ x: 1 }] }, ['list[0].x'])).toEqual({
      list: [{ x: 1 }],
    })
  })

  it('skips paths that do not resolve', () => {
    expect(pickPaths({ a: 1 }, ['missing'])).toEqual({})
    expect(pickPaths({ a: 1 }, ['a.b'])).toEqual({})
    expect(pickPaths({ a: 1 }, [])).toEqual({})
  })

  it('keeps a key whose value is undefined', () => {
    expect('a' in pickPaths({ a: undefined }, ['a'])).toBe(true)
  })

  it('reads a segment array as one nested path', () => {
    expect(pickPaths({ a: { b: 1, c: 2 } }, [['a', 'b']])).toEqual({
      a: { b: 1 },
    })
  })

  it('never writes into the source', () => {
    const source = { id: 1, user: { email: 'a@b.c', name: 'a' } }
    pickPaths(source, ['user.email'])
    expect(source).toEqual({ id: 1, user: { email: 'a@b.c', name: 'a' } })
  })

  it('returns an empty object for a nullish input', () => {
    expect(pickPaths(null, ['a'])).toEqual({})
    expect(pickPaths(undefined, ['a'])).toEqual({})
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects(
      { id: 1, user: { email: 'a@b.c', name: 'a' } },
      (input) => pickPaths(input, ['id', 'user.email']),
    )
    expect(value).toEqual({ id: 1, user: { email: 'a@b.c' } })
  })
})
