import { eqOrIn } from './eq-or-in.util.js'

describe('eqOrIn', function () {
  it('returns a $in for multiple values', function () {
    assert.deepStrictEqual(eqOrIn([1, 2, 3]), { $in: [1, 2, 3] })
  })

  it('returns the bare value for a single value', function () {
    assert.strictEqual(eqOrIn([1]), 1)
    assert.strictEqual(eqOrIn(['abc']), 'abc')
  })

  it('deduplicates values', function () {
    assert.deepStrictEqual(eqOrIn([1, 2, 1, 2, 3]), { $in: [1, 2, 3] })
  })

  it('collapses to the bare value if dedupe leaves one value', function () {
    assert.strictEqual(eqOrIn([1, 1, 1]), 1)
  })

  it('keeps the first occurrence order when deduplicating', function () {
    assert.deepStrictEqual(eqOrIn([3, 1, 3, 2]), { $in: [3, 1, 2] })
  })

  it('returns an empty $in for an empty array', function () {
    assert.deepStrictEqual(eqOrIn([]), { $in: [] })
  })

  it('deduplicates deep-equal objects across references', function () {
    assert.deepStrictEqual(eqOrIn([{ id: 1 }, { id: 1 }]), { id: 1 })
    assert.deepStrictEqual(eqOrIn([{ id: 1 }, { id: 2 }]), {
      $in: [{ id: 1 }, { id: 2 }],
    })
  })

  it('deduplicates equal dates', function () {
    assert.deepStrictEqual(eqOrIn([new Date(5), new Date(5)]), new Date(5))
    assert.deepStrictEqual(eqOrIn([new Date(5), new Date(6)]), {
      $in: [new Date(5), new Date(6)],
    })
  })

  it('does not mutate the input', function () {
    const values = [1, 1, 2]
    eqOrIn(values)
    assert.deepStrictEqual(values, [1, 1, 2])
  })

  it('accepts a readonly array', function () {
    const values = [1, 2] as const
    assert.deepStrictEqual(eqOrIn(values), { $in: [1, 2] })
  })

  it('handles null and undefined as regular values', function () {
    assert.strictEqual(eqOrIn([null]), null)
    assert.deepStrictEqual(eqOrIn([null, undefined]), {
      $in: [null, undefined],
    })
  })
})
