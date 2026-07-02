import safeStringify from 'safe-stable-stringify'
import { isPlainObject } from '../../common/index.js'

const arrayOperators = new Set(['$or', '$and', '$nor', '$not', '$in', '$nin'])

/**
 * Recursively canonicalizes a value so semantically-equal inputs produce the
 * same structure:
 * - **sortObject**: object keys are sorted recursively.
 * - **sortArray**: elements of query array operators (`$or`, `$and`, `$nor`,
 *   `$not`, `$in`, `$nin`) are order-normalized.
 *
 * Only plain objects and arrays are rebuilt; special objects (`Date`, `RegExp`,
 * `ObjectId`, class instances, ...) are passed through untouched.
 *
 * Cycles are handled by passing the already-seen reference straight through:
 * this stops our own recursion while leaving the cyclic topology intact, so a
 * downstream `safe-stable-stringify` pass can replace it with `[Circular]`.
 *
 * @internal shared by `sortQueryProperties` and `stringifyParams`.
 */
export const normalize = (
  value: any,
  seen: WeakSet<object> = new WeakSet(),
): any => {
  if (Array.isArray(value)) {
    return value.map((el) => normalize(el, seen))
  }

  if (!isPlainObject(value)) {
    return value
  }

  if (seen.has(value)) {
    return value
  }
  seen.add(value)

  const result: Record<string, any> = {}
  for (const key of Object.keys(value).sort()) {
    const child = normalize(value[key], seen)

    if (arrayOperators.has(key) && Array.isArray(child)) {
      // Schwartzian transform: serialize each normalized element once, sort by
      // that key, then unwrap. `safeStringify` keeps this crash-safe on cyclic
      // or otherwise non-serializable elements.
      result[key] = child
        .map((el) => ({ k: safeStringify(el) ?? '', v: el }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
        .map((entry) => entry.v)
    } else {
      result[key] = child
    }
  }

  seen.delete(value)
  return result
}
