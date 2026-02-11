import type { Params } from '@feathersjs/feathers'

/**
 * Make the `query` property of `Params` required and non-nullable.
 *
 * By default, the `query` property in `Params` is optional and can be `undefined`. This utility type ensures that `query` is always present and not `null` or `undefined`, which can be useful for functions that rely on the presence of a query object.
 */
export type RequiredQuery<P extends Params> = P & {
  query: NonNullable<P['query']>
}
