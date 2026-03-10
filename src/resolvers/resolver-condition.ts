import type { HookContext } from '@feathersjs/feathers'
import type { ResolverPropertyOptions } from './resolvers.internal.js'

export type ResolverCondition<H extends HookContext = HookContext> = (
  options: ResolverPropertyOptions<any, any, H>,
) => boolean
