import { neOrNin } from './ne-or-nin.util.js'

describe('neOrNin', function () {
  it('returns a $nin for multiple values', function () {
    assert.deepStrictEqual(neOrNin([1, 2, 3]), { $nin: [1, 2, 3] })
  })

  it('returns a $ne for a single value', function () {
    assert.deepStrictEqual(neOrNin([1]), { $ne: 1 })
    assert.deepStrictEqual(neOrNin(['abc']), { $ne: 'abc' })
  })

  it('deduplicates values', function () {
    assert.deepStrictEqual(neOrNin([1, 2, 1, 2, 3]), { $nin: [1, 2, 3] })
  })

  it('collapses to $ne if dedupe leaves one value', function () {
    assert.deepStrictEqual(neOrNin([1, 1, 1]), { $ne: 1 })
  })

  it('keeps the first occurrence order when deduplicating', function () {
    assert.deepStrictEqual(neOrNin([3, 1, 3, 2]), { $nin: [3, 1, 2] })
  })

  it('returns an empty $nin for an empty array', function () {
    assert.deepStrictEqual(neOrNin([]), { $nin: [] })
  })

  it('deduplicates deep-equal objects across references', function () {
    assert.deepStrictEqual(neOrNin([{ id: 1 }, { id: 1 }]), { $ne: { id: 1 } })
    assert.deepStrictEqual(neOrNin([{ id: 1 }, { id: 2 }]), {
      $nin: [{ id: 1 }, { id: 2 }],
    })
  })

  it('deduplicates equal dates', function () {
    assert.deepStrictEqual(neOrNin([new Date(5), new Date(5)]), {
      $ne: new Date(5),
    })
    assert.deepStrictEqual(neOrNin([new Date(5), new Date(6)]), {
      $nin: [new Date(5), new Date(6)],
    })
  })

  it('does not mutate the input', function () {
    const values = [1, 1, 2]
    neOrNin(values)
    assert.deepStrictEqual(values, [1, 1, 2])
  })

  it('accepts a readonly array', function () {
    const values = [1, 2] as const
    assert.deepStrictEqual(neOrNin(values), { $nin: [1, 2] })
  })

  it('handles null and undefined as regular values', function () {
    assert.deepStrictEqual(neOrNin([null]), { $ne: null })
    assert.deepStrictEqual(neOrNin([null, undefined]), {
      $nin: [null, undefined],
    })
  })
})
