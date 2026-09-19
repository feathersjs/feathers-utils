import { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import type { RealTimeConnection } from '@feathersjs/feathers'
import { toChannelLeaves } from './to-channel-leaves.channel.js'

const connection = (name: string) => ({ name }) as unknown as RealTimeConnection

describe('toChannelLeaves', function () {
  it('returns an empty array for undefined and null', function () {
    assert.deepStrictEqual(toChannelLeaves(undefined), [])
    assert.deepStrictEqual(toChannelLeaves(null), [])
  })

  it('wraps a single channel', function () {
    const channel = new Channel([connection('a')])

    assert.deepStrictEqual(toChannelLeaves(channel), [channel])
  })

  it('keeps an array of channels as it is, by reference', function () {
    const first = new Channel([connection('a')])
    const second = new Channel([connection('b')])

    assert.deepStrictEqual(toChannelLeaves([first, second]), [first, second])
  })

  it('flattens nested arrays, like feathers flattenDeep does', function () {
    const first = new Channel([connection('a')])
    const second = new Channel([connection('b')])
    const third = new Channel([connection('c')])

    assert.deepStrictEqual(toChannelLeaves([first, [second, [third]]]), [
      first,
      second,
      third,
    ])
  })

  it('resolves a CombinedChannel into its children, payloads intact', function () {
    const first = new Channel([connection('a')], { id: 1 })
    const second = new Channel([connection('b')], { id: 1, secret: 'x' })

    const leaves = toChannelLeaves(new CombinedChannel([first, second]))

    assert.deepStrictEqual(leaves, [first, second])
    assert.deepStrictEqual(
      leaves.map((leaf) => leaf.data),
      [{ id: 1 }, { id: 1, secret: 'x' }],
    )
  })

  it('resolves nested CombinedChannels recursively', function () {
    const first = new Channel([connection('a')])
    const second = new Channel([connection('b')])
    const third = new Channel([connection('c')])

    const nested = new CombinedChannel([
      new CombinedChannel([first, second]),
      third,
    ])

    assert.deepStrictEqual(toChannelLeaves([nested]), [first, second, third])
  })

  it('detects a CombinedChannel by duck-typing, not instanceof', function () {
    const child = new Channel([connection('a')])
    // what a second copy of `@feathersjs/transport-commons` in the tree looks
    // like from here: the right shape, the wrong constructor
    const foreign = { children: [child] } as unknown as CombinedChannel

    assert.deepStrictEqual(toChannelLeaves(foreign), [child])
  })

  it('returns an empty array for a CombinedChannel without children', function () {
    assert.deepStrictEqual(toChannelLeaves(new CombinedChannel([])), [])
  })

  it('keeps empty channels - flattening is purely structural', function () {
    const empty = new Channel([])

    assert.deepStrictEqual(toChannelLeaves(empty), [empty])
  })
})
