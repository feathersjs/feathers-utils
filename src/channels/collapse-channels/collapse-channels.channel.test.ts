import { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import type { RealTimeConnection } from '@feathersjs/feathers'
import { collapseChannels } from './collapse-channels.channel.js'
import { connectTwo } from '../socket-harness.fixture.js'

const connection = (name: string) => ({ name }) as unknown as RealTimeConnection

describe('collapseChannels', function () {
  it('returns an empty array for nothing - "nobody", never "everybody"', function () {
    assert.deepStrictEqual(collapseChannels(undefined, { id: 1 }), [])
    assert.deepStrictEqual(collapseChannels([], { id: 1 }), [])
    assert.deepStrictEqual(collapseChannels(new CombinedChannel([]), {}), [])
  })

  it('collapses payload-less leaves into a single channel carrying the data', function () {
    const a = connection('a')
    const b = connection('b')
    const data = { id: 1 }

    const result = collapseChannels(
      [new Channel([a]), new Channel([b])],
      data,
    ) as Channel

    assert.ok(result instanceof Channel)
    assert.deepStrictEqual(result.connections, [a, b])
    assert.strictEqual(result.data, data)
  })

  it('keeps leaves apart when they carry their own payloads', function () {
    const a = connection('a')
    const b = connection('b')

    const result = collapseChannels(
      new CombinedChannel([
        new Channel([a], { id: 1 }),
        new Channel([b], { id: 1, secret: 's' }),
      ]),
      { id: 1, secret: 's' },
    ) as Channel[]

    assert.ok(Array.isArray(result))
    assert.deepStrictEqual(
      result.map((channel) => [channel.connections, channel.data]),
      [
        [[a], { id: 1 }],
        [[b], { id: 1, secret: 's' }],
      ],
    )
  })

  it('gives a payload-less leaf the event data, rather than the dispatcher fallback', function () {
    const a = connection('a')
    const b = connection('b')
    const data = { id: 1, secret: 's' }

    const result = collapseChannels(
      [new Channel([a], { id: 1 }), new Channel([b])],
      data,
    ) as Channel[]

    assert.strictEqual(result[1].data, data)
  })

  it('keeps a connection in the first leaf that holds it, like feathers does', function () {
    const shared = connection('shared')
    const other = connection('other')

    const result = collapseChannels(
      [
        new Channel([shared], { id: 1 }),
        new Channel([shared, other], { id: 1, secret: 's' }),
      ],
      {},
    ) as Channel[]

    assert.deepStrictEqual(
      result.map((channel) => [channel.connections, channel.data]),
      [
        [[shared], { id: 1 }],
        [[other], { id: 1, secret: 's' }],
      ],
    )
  })

  it('dedupes within a leaf, so nobody is dispatched to twice', function () {
    const a = connection('a')

    const result = collapseChannels([new Channel([a, a])], {}) as Channel

    assert.deepStrictEqual(result.connections, [a])
  })

  it('drops leaves that are empty after deduping', function () {
    const shared = connection('shared')

    const result = collapseChannels(
      [new Channel([shared], { id: 1 }), new Channel([shared], { id: 2 })],
      {},
    ) as Channel

    assert.ok(result instanceof Channel)
    assert.ok(!Array.isArray(result))
    assert.deepStrictEqual(result.data, { id: 1 })
  })

  it('never returns a CombinedChannel, whatever it was given', function () {
    const combined = new CombinedChannel([
      new Channel([connection('a')], { id: 1 }),
      new Channel([connection('b')], { id: 2 }),
    ])

    const result = collapseChannels(combined, {})

    for (const channel of Array.isArray(result) ? result : [result]) {
      assert.ok(!(channel instanceof CombinedChannel))
      assert.strictEqual((channel as CombinedChannel).children, undefined)
    }
  })
})

describe('collapseChannels - over a real socket connection', function () {
  let wire: Awaited<ReturnType<typeof connectTwo>> | undefined

  afterEach(async function () {
    await wire?.close()
    wire = undefined
  })

  it('delivers each connection the payload of its own channel', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire

    app.publish((data: any) =>
      collapseChannels(
        [
          new Channel([a], { id: data.id, title: data.title }),
          new Channel([b], data),
        ],
        data,
      ),
    )

    await wire.create({ title: 'hi', secret: 's' })

    assert.deepStrictEqual(wire.received.a, [{ id: 0, title: 'hi' }])
    assert.deepStrictEqual(wire.received.b, [
      { id: 0, title: 'hi', secret: 's' },
    ])
  }, 10000)

  it('sends the event data to everyone when no channel carries a payload', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire

    app.publish((data: any) => collapseChannels([new Channel([a, b])], data))

    await wire.create({ title: 'hi', secret: 's' })

    assert.deepStrictEqual(wire.received.a, [
      { id: 0, title: 'hi', secret: 's' },
    ])
    assert.deepStrictEqual(wire.received.b, wire.received.a)
  }, 10000)

  it('loses the payloads when a CombinedChannel is returned - which is why collapseChannels never returns one', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire

    app.publish(
      (data: any) =>
        // exactly the channels of the first test, only nested instead of flat:
        // feathers flattens arrays, never a `CombinedChannel`, so this becomes a
        // single child whose own `data` is `null` - and the dispatcher reads
        // `null` as "send the full event data"
        new CombinedChannel([
          new Channel([a], { id: data.id, title: data.title }),
          new Channel([b], data),
        ]),
    )

    await wire.create({ title: 'hi', secret: 's' })

    assert.deepStrictEqual(wire.received.a, [
      { id: 0, title: 'hi', secret: 's' },
    ])
    assert.deepStrictEqual(wire.received.b, wire.received.a)
  }, 10000)
})
