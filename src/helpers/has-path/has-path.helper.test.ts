import { hasPath } from './has-path.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

describe('hasPath', () => {
  it('is true for an own property along the whole path', () => {
    expect(hasPath({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(true)
    expect(hasPath({ list: [{ x: 1 }] }, 'list[0].x')).toBe(true)
    expect(hasPath({ list: [{ x: 1 }] }, 'list.0.x')).toBe(true)
  })

  it('is true for a property that exists but is undefined', () => {
    expect(hasPath({ a: { b: undefined } }, 'a.b')).toBe(true)
  })

  it('is false when the path breaks off', () => {
    expect(hasPath({ a: { b: 2 } }, 'a.b.c')).toBe(false)
    expect(hasPath({ a: 5 }, 'a.b')).toBe(false)
    expect(hasPath({ a: null }, 'a.b')).toBe(false)
    expect(hasPath({}, 'a.b')).toBe(false)
    expect(hasPath(null, 'a')).toBe(false)
    expect(hasPath(undefined, 'a')).toBe(false)
  })

  it('ignores inherited properties', () => {
    expect(hasPath({}, 'toString')).toBe(false)
    expect(hasPath({ a: {} }, 'a.toString')).toBe(false)
    expect(hasPath(Object.create({ inherited: 1 }), 'inherited')).toBe(false)
  })

  it('checks array indices against the array length', () => {
    expect(hasPath({ list: [1, 2] }, 'list[0]')).toBe(true)
    expect(hasPath({ list: [1, 2] }, 'list[1]')).toBe(true)
    expect(hasPath({ list: [1, 2] }, 'list[2]')).toBe(false)
    expect(hasPath({ list: [] }, 'list[0]')).toBe(false)
  })

  it('finds a key that literally contains a dot', () => {
    expect(hasPath({ 'a.b': 1 }, 'a.b')).toBe(true)
  })

  it('handles the empty path and numeric keys', () => {
    expect(hasPath({}, '')).toBe(false)
    expect(hasPath({ '': 7 }, '')).toBe(true)
    expect(hasPath({ 0: 'zero' }, 0)).toBe(true)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects({ list: [{ x: 1 }] }, (input) =>
      hasPath(input, 'list[0].x'),
    )
    expect(value).toBe(true)
  })
})
