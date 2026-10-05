import { getPath, isDeepEqual, toArray } from '../../common/index.js'
import type { MaybeArray } from '../../internal.utils.js'
import type { FieldKey } from '../../types.js'

export type Changes = Record<string, { before: unknown; after: unknown }>

/**
 * Compares two versions of an item and returns the fields that differ, each
 * with its value before and after - an empty object if nothing changed.
 * Compares the given `fields`, nested paths like `'address.city'` included,
 * or else every top-level property of either item. A missing item - before a
 * `create`, after a `remove` - has no fields.
 *
 * Values are compared by content with `isDeepEqual` - class instances like a
 * bson `ObjectId` too, so two fetches of the same item show no changes. A
 * class that keeps its value in `#private` fields can't be compared that way.
 *
 * @example
 * ```ts
 * import { getChanges } from 'feathers-utils/utils'
 *
 * getChanges({ name: 'Anna', age: 30 }, { name: 'Anna', age: 31 })
 * // => { age: { before: 30, after: 31 } }
 *
 * // with `stashed` - e.g. for an audit log
 * for (const { before, result } of await stashed(context)) {
 *   const changes = getChanges(before, result, ['email', 'role'])
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/get-changes.html
 */
export function getChanges<T extends Record<string, any>>(
  before: T | null | undefined,
  after: T | null | undefined,
  fields?: MaybeArray<FieldKey<T>>,
): Changes {
  const changes: Changes = {}

  const compare = (path: string) => {
    const valueBefore = getPath(before, path)
    const valueAfter = getPath(after, path)
    if (!isDeepEqual(valueBefore, valueAfter)) {
      changes[path] = { before: valueBefore, after: valueAfter }
    }
  }

  if (fields !== undefined) {
    for (const path of toArray(fields) as string[]) compare(path)
    return changes
  }

  // every top-level property of either item, once
  for (const key in before) compare(key)
  for (const key in after) {
    if (before == null || !Object.prototype.hasOwnProperty.call(before, key)) {
      compare(key)
    }
  }
  return changes
}
