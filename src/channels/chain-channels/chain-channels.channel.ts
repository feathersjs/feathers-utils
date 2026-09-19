import type { Channel } from '@feathersjs/transport-commons'
import type { HookContext } from '@feathersjs/feathers'
import { collapseChannels } from '../collapse-channels/collapse-channels.channel.js'
import { toChannelLeaves } from '../to-channel-leaves/to-channel-leaves.channel.js'
import type { AnyChannels, ChannelPublisher } from '../types.js'

/**
 * Composes several publishers into one, each narrowing what the step before it
 * produced - instead of nesting them, with a rule about which one goes inside
 * that lives only in prose.
 *
 * A step is either channels, which replace whatever came before, or a
 * `(data, context, channels)` function returning any shape feathers accepts.
 * The chain starts from every channel of the app, normalizes between steps, and
 * ends in `collapseChannels`, so a payload a step worked out for a single
 * connection survives into the dispatcher. Steps are synchronous.
 *
 * Order is yours to get right: whatever hands out per-connection payloads has
 * to come last, and a step that narrows has to keep each channel's `data` -
 * `filterChannelLeaves` does.
 *
 * @example
 * ```ts
 * import { chainChannels, filterChannelLeaves } from 'feathers-utils/channels'
 *
 * app.publish(
 *   chainChannels([
 *     app.channel('authenticated'),
 *     // only the connections that subscribed to this service
 *     (data, context, channels) =>
 *       filterChannelLeaves(channels, (connection) =>
 *         subscribed(connection, context.path),
 *       ),
 *     // last, because it is what hands out the per-connection payloads: one
 *     // channel per set of fields the connections in it may read
 *     (data, context, channels) => channelsPerReadableFields(data, channels),
 *   ]),
 * )
 * ```
 *
 * @see https://utils.feathersjs.com/channels/chain-channels.html
 */
export function chainChannels(
  steps: (AnyChannels | ChannelPublisher)[],
): (data: any, context: HookContext) => Channel | Channel[] {
  return (data, context) => {
    const { app } = context

    let leaves = app.channels.length
      ? toChannelLeaves(app.channel(app.channels))
      : []

    for (const step of steps) {
      leaves = toChannelLeaves(
        typeof step === 'function' ? step(data, context, leaves) : step,
      )
    }

    return collapseChannels(leaves, data)
  }
}
