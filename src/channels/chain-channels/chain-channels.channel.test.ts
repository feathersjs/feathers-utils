import { feathers } from '@feathersjs/feathers'
import type { HookContext, RealTimeConnection } from '@feathersjs/feathers'
import {
  Channel,
  CombinedChannel,
  channels,
} from '@feathersjs/transport-commons'
import { chainChannels } from './chain-channels.channel.js'
import { filterChannelLeaves } from '../filter-channel-leaves/filter-channel-leaves.channel.js'
import { toChannelLeaves } from '../to-channel-leaves/to-channel-leaves.channel.js'
import type { AnyChannels, ChannelPublisher } from '../types.js'
import { connectTwo } from '../socket-harness.fixture.js'

const connection = (name: string) => ({ name }) as unknown as RealTimeConnection

function setup() {
  const app = feathers()

  app.configure(channels())

  return { app, context: { app } as unknown as HookContext }
}

describe('chainChannels', function () {
  it('starts from every channel of the app', function () {
    const { app, context } = setup()
    const a = connection('a')
    const b = connection('b')

    app.channel('authenticated').join(a)
    app.channel('anonymous').join(b)

    const result = chainChannels([])({ id: 1 }, context) as Channel

    assert.deepStrictEqual(result.connections, [a, b])
  })

  it('publishes to nobody when the app has no channels at all', function () {
    const { context } = setup()

    assert.deepStrictEqual(chainChannels([])({ id: 1 }, context), [])
  })

  it('takes channels as a step, replacing what came before', function () {
    const { app, context } = setup()
    const a = connection('a')

    app.channel('authenticated').join(a)
    app.channel('anonymous').join(connection('b'))

    const result = chainChannels([app.channel('authenticated')])(
      { id: 1 },
      context,
    ) as Channel

    assert.deepStrictEqual(result.connections, [a])
  })

  it('hands each function step the data, the context and the leaves so far', function () {
    const { app, context } = setup()
    const a = connection('a')
    const b = connection('b')
    const c = connection('c')
    const data = { id: 1 }

    app.channel('all').join(a, b, c)

    const seen: any[] = []
    const drop =
      (dropped: RealTimeConnection): ChannelPublisher =>
      (stepData, stepContext, leaves) => {
        seen.push([stepData, stepContext, leaves.flatMap((l) => l.connections)])

        return leaves.map((leaf) => leaf.filter((conn) => conn !== dropped))
      }

    const result = chainChannels([drop(a), drop(b)])(data, context) as Channel

    assert.deepStrictEqual(seen, [
      [data, context, [a, b, c]],
      [data, context, [b, c]],
    ])
    assert.deepStrictEqual(result.connections, [c])
  })

  it('normalizes whatever a step returns before the next one sees it', function () {
    const { app, context } = setup()
    const a = connection('a')
    const b = connection('b')

    app.channel('all').join(a, b)

    // a shape feathers accepts, but a step should not have to expect
    const nest: ChannelPublisher = (_data, _context, leaves) =>
      new CombinedChannel([new CombinedChannel(leaves)])

    const seen: Channel[][] = []
    const record: ChannelPublisher = (_data, _context, leaves) => {
      seen.push(leaves)

      return leaves
    }

    chainChannels([nest, record])({ id: 1 }, context)

    assert.strictEqual(seen[0].length, 1)
    assert.deepStrictEqual(seen[0][0].connections, [a, b])
  })

  it('reads undefined from a step as "nobody"', function () {
    const { app, context } = setup()

    app.channel('all').join(connection('a'))

    assert.deepStrictEqual(
      chainChannels([() => undefined])({ id: 1 }, context),
      [],
    )
  })

  it('stays empty once a step returns [] - never "all channels" again', function () {
    const { app, context } = setup()

    app.channel('all').join(connection('a'))

    const narrow: ChannelPublisher = (_data, _context, leaves) =>
      leaves.map((leaf) => leaf.filter(() => true))

    assert.deepStrictEqual(
      chainChannels([() => [], narrow])({ id: 1 }, context),
      [],
    )
  })

  it('keeps a per-connection payload a step handed out, flat', function () {
    const { app, context } = setup()
    const a = connection('a')
    const b = connection('b')

    app.channel('all').join(a, b)

    const restrict: ChannelPublisher = (data, _context, leaves) =>
      leaves.flatMap((leaf) =>
        leaf.connections.map((conn) =>
          conn === a
            ? new Channel([conn], { id: data.id })
            : new Channel([conn], data),
        ),
      )

    const result = chainChannels([restrict])(
      { id: 1, secret: 's' },
      context,
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
})

/**
 * Every shape a step may have - channels of any nesting, or a function
 * returning them. What a step is handed is ignored here; that the chain hands
 * the right thing on is covered above.
 */
describe('chainChannels - step shapes', function () {
  function fixture() {
    const { app, context } = setup()
    const a = connection('a')
    const b = connection('b')
    const c = connection('c')

    app.channel('x').join(a)
    app.channel('y').join(b)
    app.channel('z').join(c)

    return { app, context, a, b, c }
  }

  type Fixture = ReturnType<typeof fixture>

  const cases: {
    name: string
    step: (fix: Fixture) => AnyChannels | ChannelPublisher
    expected: (fix: Fixture) => RealTimeConnection[]
  }[] = [
    // channels, handed in directly
    {
      name: 'a Channel',
      step: ({ app }) => app.channel('x'),
      expected: ({ a }) => [a],
    },
    {
      name: 'a CombinedChannel',
      step: ({ app }) => app.channel('x', 'y'),
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a Channel[]',
      step: ({ app }) => [app.channel('x'), app.channel('y')],
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a nested array',
      step: ({ app }) => [[app.channel('x')], [[app.channel('y')]]],
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a hand-built Channel',
      step: ({ a, c }) => new Channel([a, c]),
      expected: ({ a, c }) => [a, c],
    },
    {
      name: 'a CombinedChannel without children',
      step: () => new CombinedChannel([]),
      expected: () => [],
    },
    { name: 'undefined', step: () => undefined, expected: () => [] },
    { name: 'null', step: () => null, expected: () => [] },
    { name: 'an empty array', step: () => [], expected: () => [] },

    // the same shapes, returned by a publisher
    {
      name: 'a publisher returning a Channel',
      step:
        ({ app }): ChannelPublisher =>
        () =>
          app.channel('x'),
      expected: ({ a }) => [a],
    },
    {
      name: 'a publisher returning a CombinedChannel',
      step:
        ({ app }): ChannelPublisher =>
        () =>
          app.channel('x', 'y'),
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a publisher returning a Channel[]',
      step:
        ({ app }): ChannelPublisher =>
        () => [app.channel('x'), app.channel('y')],
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a publisher returning a nested array',
      step:
        ({ app }): ChannelPublisher =>
        () => [[app.channel('x')], [[app.channel('y')]]],
      expected: ({ a, b }) => [a, b],
    },
    {
      name: 'a publisher returning undefined',
      step: (): ChannelPublisher => () => undefined,
      expected: () => [],
    },
    {
      name: 'a publisher returning null',
      step: (): ChannelPublisher => () => null,
      expected: () => [],
    },
    {
      name: 'a publisher returning []',
      step: (): ChannelPublisher => () => [],
      expected: () => [],
    },
    {
      name: 'a publisher returning what it was handed',
      step: (): ChannelPublisher => (_data, _context, leaves) => leaves,
      expected: ({ a, b, c }) => [a, b, c],
    },
  ]

  for (const { name, step, expected } of cases) {
    it(`takes ${name}`, function () {
      const fix = fixture()

      const result = chainChannels([step(fix)])({ id: 1 }, fix.context)

      assert.deepStrictEqual(
        toChannelLeaves(result).flatMap((leaf) => leaf.connections),
        expected(fix),
      )
    })
  }

  it('lets the last channel step win', function () {
    const fix = fixture()

    const result = chainChannels([fix.app.channel('x'), fix.app.channel('y')])(
      { id: 1 },
      fix.context,
    ) as Channel

    assert.deepStrictEqual(result.connections, [fix.b])
  })

  it('narrows a channel step with a publisher step after it', function () {
    const fix = fixture()

    const result = chainChannels([
      fix.app.channel('x', 'y'),
      (_data, _context, leaves) =>
        filterChannelLeaves(leaves, (conn) => conn !== fix.a),
    ])({ id: 1 }, fix.context) as Channel

    assert.deepStrictEqual(result.connections, [fix.b])
  })

  it('keeps the payload a channel step carries', function () {
    const fix = fixture()

    const result = chainChannels([new Channel([fix.a], { id: 7 })])(
      { id: 1, secret: 's' },
      fix.context,
    ) as Channel

    assert.deepStrictEqual(result.data, { id: 7 })
  })

  it('gives a payload-less channel step the event data', function () {
    const fix = fixture()
    const data = { id: 1, secret: 's' }

    const result = chainChannels([new Channel([fix.a])])(
      data,
      fix.context,
    ) as Channel

    assert.strictEqual(result.data, data)
  })
})

/**
 * A chain only pays off once the events are actually dispatched: a lost payload
 * or a channel that quietly turns back into "everybody" is invisible until then.
 */
describe('chainChannels - over a real socket connection', function () {
  let wire: Awaited<ReturnType<typeof connectTwo>> | undefined

  afterEach(async function () {
    await wire?.close()
    wire = undefined
  })

  it('delivers the payload a chain step worked out, per connection', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire
    const outsider = connection('outsider')

    app.channel('everyone').join(a, b, outsider)

    app.publish(
      chainChannels([
        app.channel('everyone'),
        (_data, _context, leaves) =>
          filterChannelLeaves(leaves, (conn) => conn !== outsider),
        // what a field-restricting publisher does: one channel per payload
        (data, _context, leaves) =>
          leaves.flatMap((leaf) =>
            leaf.connections.map((conn) =>
              conn === a
                ? new Channel([conn], { id: data.id, title: data.title })
                : new Channel([conn], data),
            ),
          ),
      ]),
    )

    await wire.create({ title: 'hi', secret: 's' })

    assert.deepStrictEqual(wire.received.a, [{ id: 0, title: 'hi' }])
    assert.deepStrictEqual(wire.received.b, [
      { id: 0, title: 'hi', secret: 's' },
    ])
  }, 10000)

  it('starts from every channel of the app when no step supplies any', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire

    app.channel('authenticated').join(a)
    app.channel('anonymous').join(b)

    app.publish(chainChannels([]))

    await wire.create({ title: 'hi', secret: 's' })

    assert.deepStrictEqual(wire.received.a, [
      { id: 0, title: 'hi', secret: 's' },
    ])
    assert.deepStrictEqual(wire.received.b, wire.received.a)
  }, 10000)

  it('publishes to nobody when a step returns [] - not to everybody', async function () {
    wire = await connectTwo()
    const { app, a, b } = wire

    app.channel('everyone').join(a, b)

    app.publish(chainChannels([() => []]))
    await wire.createOnly({ title: 'silent' })

    // a barrier rather than a timeout: this one goes to everyone, and socket.io
    // keeps the order of events per connection - so once it has arrived, the
    // one before it either arrived too, or never will
    app.publish(chainChannels([]))
    await wire.create({ title: 'barrier' })

    assert.deepStrictEqual(
      wire.received.a.map((message) => message.title),
      ['barrier'],
    )
    assert.deepStrictEqual(
      wire.received.b.map((message) => message.title),
      ['barrier'],
    )
  }, 10000)
})
