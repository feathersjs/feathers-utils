import { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import type { RealTimeConnection } from '@feathersjs/feathers'
import { filterChannelLeaves } from './filter-channel-leaves.channel.js'

const connection = (name: string) => ({ name }) as unknown as RealTimeConnection

describe('filterChannelLeaves', function () {
  it('narrows a channel to the connections the predicate keeps', function () {
    const kept = connection('a')
    const dropped = connection('b')

    const leaves = filterChannelLeaves(
      new Channel([kept, dropped]),
      (conn) => conn === kept,
    )

    assert.strictEqual(leaves.length, 1)
    assert.deepStrictEqual(leaves[0].connections, [kept])
  })

  it('keeps the payload of every leaf it narrows', function () {
    const a = connection('a')
    const b = connection('b')

    const leaves = filterChannelLeaves(
      new CombinedChannel([
        new Channel([a, connection('x')], { id: 1 }),
        new Channel([b, connection('y')], { id: 1, secret: 's' }),
      ]),
      (conn) => conn === a || conn === b,
    )

    assert.deepStrictEqual(
      leaves.map((leaf) => [leaf.connections, leaf.data]),
      [
        [[a], { id: 1 }],
        [[b], { id: 1, secret: 's' }],
      ],
    )
  })

  it('drops the leaves that end up empty', function () {
    const kept = connection('a')

    const leaves = filterChannelLeaves(
      [new Channel([connection('b')]), new Channel([kept])],
      (conn) => conn === kept,
    )

    assert.strictEqual(leaves.length, 1)
    assert.deepStrictEqual(leaves[0].connections, [kept])
  })

  it('returns an empty array when nothing is kept', function () {
    assert.deepStrictEqual(
      filterChannelLeaves(new Channel([connection('a')]), () => false),
      [],
    )
  })

  it('returns an empty array for undefined', function () {
    assert.deepStrictEqual(
      filterChannelLeaves(undefined, () => true),
      [],
    )
  })

  it('never adds a connection, and never mutates the input', function () {
    const a = connection('a')
    const input = new Channel([a], { id: 1 })

    const [leaf] = filterChannelLeaves(input, () => true)

    assert.notStrictEqual(leaf, input)
    assert.deepStrictEqual(input.connections, [a])
    assert.deepStrictEqual(leaf.connections, [a])
    assert.deepStrictEqual(leaf.data, { id: 1 })
  })
})
