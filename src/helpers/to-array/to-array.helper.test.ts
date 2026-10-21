import { toArray } from './to-array.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

describe('toArray', () => {
  it('wraps a non-array value in an array', () => {
    expect(toArray(1)).toEqual([1])
    expect(toArray('a')).toEqual(['a'])
  })

  it('returns an array as-is (same reference, no copy)', () => {
    const input = [1, 2]
    expect(toArray(input)).toBe(input)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects({ list: [1, 2] }, (input) =>
      toArray(input.list),
    )
    expect(value).toEqual([1, 2])
  })
})
