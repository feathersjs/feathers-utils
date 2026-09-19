import type { Channel } from '@feathersjs/transport-commons'
import type { RealTimeConnection } from '@feathersjs/feathers'
import { toChannelLeaves } from '../to-channel-leaves/to-channel-leaves.channel.js'
import type { AnyChannels } from '../types.js'

/**
 * Narrows every leaf channel to the connections the predicate keeps, and drops
 * the leaves that end up empty.
 *
 * Each leaf keeps its own `data`, so a payload an earlier publisher worked out
 * per connection - one channel per set of readable fields, say - still belongs
 * to the right connections. Flattening the channels into a single one first
 * would hand everyone the full event data instead.
 *
 * @example
 * ```ts
 * import { filterChannelLeaves, collapseChannels } from 'feathers-utils/channels'
 *
 * app.publish((data, context) => {
 *   const subscribed = new Set(subscriptions.connectionsFor(context.path))
 *
 *   return collapseChannels(
 *     filterChannelLeaves(app.channel(app.channels), (connection) =>
 *       subscribed.has(connection),
 *     ),
 *     data,
 *   )
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/channels/filter-channel-leaves.html
 */
export function filterChannelLeaves(
  channels: AnyChannels,
  predicate: (connection: RealTimeConnection) => boolean,
): Channel[] {
  return toChannelLeaves(channels)
    .map((leaf) => leaf.filter(predicate))
    .filter((leaf) => leaf.connections.length > 0)
}
