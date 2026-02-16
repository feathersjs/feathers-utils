import type { HookContext } from '@feathersjs/feathers'
import type { UnwrapPaginatedOrArray } from './unwrap-paginated.js'

export type ResultSingleHookContext<H extends HookContext> =
  UnwrapPaginatedOrArray<NonNullable<H['result']>>
