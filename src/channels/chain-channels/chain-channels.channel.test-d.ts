import { expectTypeOf } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { Channel, CombinedChannel } from '@feathersjs/transport-commons'
import { chainChannels } from './chain-channels.channel.js'

const channel = new Channel()
const combined = new CombinedChannel([channel])

it('accepts every channel shape as a step', () => {
  chainChannels([
    channel,
    combined,
    [channel, combined],
    [[channel], [[combined]]],
    undefined,
    null,
    [],
  ])
})

it('accepts a publisher returning every channel shape as a step', () => {
  chainChannels([
    () => channel,
    () => combined,
    () => [channel, combined],
    () => [[channel], [[combined]]],
    () => undefined,
    () => null,
    () => [],
  ])
})

it('types the arguments of a publisher step', () => {
  chainChannels([
    (data, context, channels) => {
      expectTypeOf(data).toBeAny()
      expectTypeOf(context).toEqualTypeOf<HookContext>()
      expectTypeOf(channels).toEqualTypeOf<Channel[]>()

      return channels
    },
  ])
})

it('rejects a step that is neither channels nor a publisher', () => {
  // @ts-expect-error - a number is not a channel
  chainChannels([42])
  // @ts-expect-error - a publisher may not return something else
  chainChannels([() => 'nope'])
})

it('returns a publisher feathers accepts', () => {
  expectTypeOf(chainChannels([])).toEqualTypeOf<
    (data: any, context: HookContext) => Channel | Channel[]
  >()
})
