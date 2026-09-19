import { Channel } from '@feathersjs/transport-commons'
import type { RealTimeConnection } from '@feathersjs/feathers'
import { toChannelLeaves } from '../to-channel-leaves/to-channel-leaves.channel.js'
import type { AnyChannels } from '../types.js'

/**
 * Brings leaf channels into the shape a publisher may return, and never returns
 * a `CombinedChannel`.
 *
 * That restriction is the point. Feathers wraps a publisher's result in a
 * `CombinedChannel` of its own, which maps every connection to the payload of
 * the *child* it was found in - and it only flattens arrays. A returned
 * `CombinedChannel` therefore becomes a single child whose own `data` is
 * `null`, which the dispatcher reads as "send the full event data". A
 * per-connection payload only survives in a flat array of channels.
 *
 * Leaves without a payload of their own are given `data`, and a connection is
 * kept in the first leaf that holds it - the same first-one-wins mapping
 * feathers applies, so the order of the leaves matters and nobody is dispatched
 * to twice. With no payload anywhere there is nothing to keep apart and a
 * single `Channel` comes back; empty input yields `[]`, never "everybody".
 *
 * @example
 * ```ts
 * import { collapseChannels } from 'feathers-utils/channels'
 *
 * app.publish((data, context) => {
 *   // one channel per set of fields the connections in it may read
 *   const leaves = channelsPerReadableFields(data, app.channel(app.channels))
 *
 *   return collapseChannels(leaves, data)
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/channels/collapse-channels.html
 */
export function collapseChannels(
  channels: AnyChannels,
  data: any,
): Channel | Channel[] {
  const leaves = toChannelLeaves(channels)

  if (leaves.length === 0) {
    return []
  }

  const seen = new Set<RealTimeConnection>()

  // No leaf carries its own payload, so keeping them apart would say nothing.
  if (!leaves.some((leaf) => leaf.data != null)) {
    for (const leaf of leaves) {
      for (const connection of leaf.connections) {
        seen.add(connection)
      }
    }

    return new Channel([...seen], data)
  }

  const collapsed: Channel[] = []

  for (const leaf of leaves) {
    const connections: RealTimeConnection[] = []

    for (const connection of leaf.connections) {
      if (seen.has(connection)) {
        continue
      }

      seen.add(connection)
      connections.push(connection)
    }

    if (connections.length > 0) {
      collapsed.push(new Channel(connections, leaf.data ?? data))
    }
  }

  return collapsed.length === 1 ? collapsed[0] : collapsed
}
