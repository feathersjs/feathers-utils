import safeStringify from 'safe-stable-stringify'
import type { Params } from '@feathersjs/feathers'
import { normalize } from '../sort-query-properties/normalize.js'

/**
 * Serializes Feathers `params` into a stable, deterministic string — built for
 * generating cache keys.
 *
 * Two normalizations make semantically-equal params produce the same string:
 * - **sortObject**: object keys are sorted recursively.
 * - **sortArray**: elements of query array operators (`$or`, `$and`, `$nor`,
 *   `$not`, `$in`, `$nin`) are order-normalized.
 *
 * Symbol keys - sequelize uses them as operators - are part of the string: a
 * registered symbol (`Symbol.for('gt')`, as sequelize's are) as
 * `Symbol.for(gt)`, any other symbol by its description. So
 * `{ age: { [Op.gt]: 18 } }` and `{ age: { [Op.lt]: 18 } }` never share a key.
 *
 * Serialization is crash-safe and never throws on values that leak through a
 * params whitelist: circular references become `[Circular]`,
 * functions/`undefined`/symbol values are dropped (like `JSON.stringify`),
 * `BigInt` is stringified, and objects with `toJSON` (e.g. `Date`, bson
 * `ObjectId`) are serialized via it.
 *
 * @example
 * ```ts
 * import { stringifyParams } from 'feathers-utils/utils'
 *
 * stringifyParams({ query: { name: 'John', age: 30 } })
 * // === stringifyParams({ query: { age: 30, name: 'John' } })
 * ```
 *
 * @see https://utils.feathersjs.com/utils/stringify-params.html
 */
export const stringifyParams = (params: Params): string => {
  return safeStringify(normalize(params, { encodeSymbols: true })) ?? ''
}
