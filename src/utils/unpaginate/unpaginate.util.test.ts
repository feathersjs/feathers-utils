import { toPaginated } from '../to-paginated/to-paginated.util.js'
import { unpaginate } from './unpaginate.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('unpaginate', function () {
  it('returns an array as-is (same reference, no copy)', function () {
    const arrayResult = [{ id: 1 }, { id: 2 }, { id: 3 }]

    assert.strictEqual(unpaginate(arrayResult), arrayResult)
  })

  it('extracts data from a paginated result', function () {
    const data = [{ id: 1 }, { id: 2 }]

    assert.strictEqual(unpaginate({ total: 5, limit: 2, skip: 0, data }), data)
  })

  it('returns an empty array for an empty paginated result', function () {
    assert.deepStrictEqual(
      unpaginate({ total: 0, limit: 10, skip: 0, data: [] }),
      [],
    )
  })

  it('returns an empty array for undefined and null', function () {
    assert.deepStrictEqual(unpaginate(undefined), [])
    assert.deepStrictEqual(unpaginate(null), [])
  })

  it('returns an empty array when a paginated result has no data', function () {
    assert.deepStrictEqual(unpaginate({} as any), [])
  })

  it('round-trips a paginated result built by toPaginated', function () {
    const items = [{ id: 1 }, { id: 2 }]

    assert.strictEqual(unpaginate(toPaginated(items)), items)
  })

  it('does not mutate the result', async function () {
    await expectNoSideEffects(
      { total: 1, limit: 10, skip: 0, data: [{ id: 1 }] },
      (result) => unpaginate(result),
    )
  })
})
