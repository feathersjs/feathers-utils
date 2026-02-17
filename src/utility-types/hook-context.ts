import type { HookContext } from '@feathersjs/feathers'
import type { UnwrapPaginatedOrArray } from './unwrap-paginated.js'
import type { UnwrapArray } from '../internal.utils.js'

export type ResultSingleHookContext<H extends HookContext> =
  UnwrapPaginatedOrArray<NonNullable<H['result']>>

export type DataSingleHookContext<H extends HookContext> = UnwrapArray<
  NonNullable<H['data']>
>
