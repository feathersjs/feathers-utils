import type { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import type { AnyChannels } from '../types.js'

/**
 * Flattens anything a publisher may return into a flat list of leaf channels -
 * the shape the other channel utilities work on. Arrays and the children of a
 * `CombinedChannel` are resolved recursively, `undefined` and `null` become
 * `[]`. Empty channels are kept: flattening is purely structural.
 *
 * A `CombinedChannel` is recognized by its `children` rather than with
 * `instanceof`, because a package manager may well install more than one copy
 * of `@feathersjs/transport-commons`.
 *
 * @example
 * ```ts
 * import { toChannelLeaves } from 'feathers-utils/channels'
 *
 * toChannelLeaves(app.channel('authenticated', 'anonymous')) // => [Channel, Channel]
 * toChannelLeaves(undefined) // => []
 * ```
 *
 * @see https://utils.feathersjs.com/channels/to-channel-leaves.html
 */
export function toChannelLeaves(channels: AnyChannels): Channel[] {
  if (!channels) {
    return []
  }

  if (Array.isArray(channels)) {
    return channels.flatMap((entry) => toChannelLeaves(entry))
  }

  const { children } = channels as CombinedChannel

  return Array.isArray(children)
    ? children.flatMap((child) => toChannelLeaves(child))
    : [channels]
}
