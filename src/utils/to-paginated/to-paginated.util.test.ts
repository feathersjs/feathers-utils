import { toPaginated } from './to-paginated.util.js'

describe('toPaginated', function () {
  it('converts an array to a paginated object', function () {
    const arrayResult = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const paginatedResult = toPaginated(arrayResult)

    assert.deepStrictEqual(paginatedResult, {
      total: 3,
      limit: 3,
      skip: 0,
      data: arrayResult,
    })
  })

  it('returns the same paginated object if already paginated', function () {
    const paginatedInput = {
      total: 5,
      limit: 2,
      skip: 0,
      data: [{ id: 1 }, { id: 2 }],
    }
    const paginatedResult = toPaginated(paginatedInput)

    assert.deepStrictEqual(paginatedResult, paginatedInput)
  })
})
