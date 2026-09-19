import type { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import type { HookContext } from '@feathersjs/feathers'

/** Everything a feathers publisher may return. Arrays may be nested. */
export type AnyChannels =
  Channel | CombinedChannel | AnyChannels[] | undefined | null

/**
 * A publisher that narrows the channels it is handed.
 */
export type ChannelPublisher = (
  data: any,
  context: HookContext,
  channels: Channel[],
) => AnyChannels
