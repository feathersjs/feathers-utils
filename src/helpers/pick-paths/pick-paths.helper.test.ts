import { pickPaths } from './pick-paths.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

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

  // the flat-key fast path has to read keys exactly like the nested path
  describe('key edge cases', () => {
    it('picks an inherited property, like `_.pick`', () => {
      expect(pickPaths({}, ['toString'])).toEqual({
        toString: Object.prototype.toString,
      })
    })

    it('skips keys that would reach a prototype', () => {
      const source = JSON.parse('{"__proto__":{"x":1},"constructor":2,"a":3}')
      const out = pickPaths(source, ['__proto__', 'constructor', 'prototype'])

      expect(Object.keys(out)).toEqual([])
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    })

    it('prefers a key that literally contains a dot or bracket', () => {
      expect(pickPaths({ 'a.b': 1, a: { b: 2 } }, ['a.b'])).toEqual({
        'a.b': 1,
      })
      expect(pickPaths({ 'a[0]': 1 }, ['a[0]'])).toEqual({ 'a[0]': 1 })
    })

    it('reads an unmatched bracket as a plain key', () => {
      expect(pickPaths({ 'a[b': 1 }, ['a[b'])).toEqual({ 'a[b': 1 })
    })

    it('picks symbol, numeric and empty keys', () => {
      const sym = Symbol('s')
      expect(pickPaths({ [sym]: 1, a: 2 }, [sym])).toEqual({ [sym]: 1 })
      expect(pickPaths({ 0: 'zero', 1: 'one' }, [0])).toEqual({ 0: 'zero' })
      expect(pickPaths({ '': 1, a: 2 }, [''])).toEqual({ '': 1 })
    })

    it('skips an empty segment array', () => {
      expect(pickPaths({ a: 1 }, [[]])).toEqual({})
    })

    it('picks from a primitive-wrapped source', () => {
      expect(pickPaths('abc' as any, ['length'])).toEqual({ length: 3 })
    })
  })
})
