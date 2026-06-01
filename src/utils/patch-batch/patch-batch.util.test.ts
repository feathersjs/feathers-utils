import { patchBatch } from './patch-batch.util.js'

describe('patchBatch', () => {
  it('patchBatch', () => {
    expect(
      patchBatch(
        [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
          { id: '3', name: 'John' },
          { id: '4', name: 'Jane' },
          { id: 5, name: 'Jack' },
        ],
        { id: 'id' },
      ),
    ).toEqual([
      [null, { name: 'John' }, { query: { id: { $in: ['1', '3'] } } }],
      [null, { name: 'Jane' }, { query: { id: { $in: ['2', '4'] } } }],
      [5, { name: 'Jack' }, undefined],
    ])
  })

  it('does not mutate the input items', () => {
    const items = [
      { id: 1, name: 'John' },
      { id: 2, name: 'John' },
      { id: 3, name: 'Jane' },
    ]

    patchBatch(items, { id: 'id' })

    expect(items).toEqual([
      { id: 1, name: 'John' },
      { id: 2, name: 'John' },
      { id: 3, name: 'Jane' },
    ])
  })

  it('groups deep-equal data regardless of key order', () => {
    expect(
      patchBatch(
        [
          { id: 1, a: 1, b: 2 },
          { id: 2, b: 2, a: 1 },
        ],
        { id: 'id' },
      ),
    ).toEqual([[null, { a: 1, b: 2 }, { query: { id: { $in: [1, 2] } } }]])
  })

  it('patchBatch with _id', () => {
    expect(
      patchBatch(
        [
          { _id: '1', name: 'John' },
          { _id: '2', name: 'Jane' },
          { _id: '3', name: 'John' },
          { _id: '4', name: 'Jane' },
          { _id: 5, name: 'Jack' },
        ],
        { id: '_id' },
      ),
    ).toEqual([
      [null, { name: 'John' }, { query: { _id: { $in: ['1', '3'] } } }],
      [null, { name: 'Jane' }, { query: { _id: { $in: ['2', '4'] } } }],
      [5, { name: 'Jack' }, undefined],
    ])
  })
})
