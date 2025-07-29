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
