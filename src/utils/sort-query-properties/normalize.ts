import safeStringify from 'safe-stable-stringify'
import { isPlainObject, setOwnProperty } from '../../common/index.js'

const arrayOperators = new Set(['$or', '$and', '$nor', '$not', '$in', '$nin'])

const isEnumerable = Object.prototype.propertyIsEnumerable

/**
 * The string a symbol key is serialized as. A registered symbol - sequelize's
 * operators are `Symbol.for('gt')` & co. - is the same in every process, which
 * matters for a cache shared between them; any other symbol is told apart by
 * its description.
 */
export const symbolKey = (symbol: symbol): string => {
  const registered = Symbol.keyFor(symbol)
  return registered === undefined
    ? `Symbol(${symbol.description ?? ''})`
    : `Symbol.for(${registered})`
}

export type NormalizeOptions = {
  /**
   * Turn symbol keys into string keys (see {@link symbolKey}), so a serialization
   * sees them - `JSON.stringify` drops them.
   */
  encodeSymbols?: boolean
}

/**
 * Recursively canonicalizes a value so semantically-equal inputs produce the
 * same structure:
 * - **sortObject**: object keys are sorted recursively; symbol keys - sequelize
 *   uses them as operators - follow the string keys.
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
export const normalize = (value: any, options?: NormalizeOptions): any =>
  normalizeValue(value, new WeakSet(), options?.encodeSymbols ?? false)

const normalizeValue = (
  value: any,
  seen: WeakSet<object>,
  encodeSymbols: boolean,
): any => {
  if (Array.isArray(value)) {
    return value.map((el) => normalizeValue(el, seen, encodeSymbols))
  }

  if (!isPlainObject(value)) {
    return value
  }

  if (seen.has(value)) {
    return value
  }
  seen.add(value)

  const result: Record<PropertyKey, any> = {}
  for (const key of Object.keys(value).sort()) {
    const child = normalizeValue(value[key], seen, encodeSymbols)

    if (arrayOperators.has(key) && Array.isArray(child)) {
      // Schwartzian transform: serialize each normalized element once, sort by
      // that key, then unwrap. `safeStringify` keeps this crash-safe on cyclic
      // or otherwise non-serializable elements.
      result[key] = child
        .map((el) => ({ k: safeStringify(el) ?? '', v: el }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
        .map((entry) => entry.v)
    } else {
      // a `__proto__` key stays a key
      setOwnProperty(result, key, child)
    }
  }

  const symbols = Object.getOwnPropertySymbols(value)
  if (symbols.length) {
    const sorted = symbols
      .filter((symbol) => isEnumerable.call(value, symbol))
      .map((symbol) => ({ symbol, key: symbolKey(symbol) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

    for (const { symbol, key } of sorted) {
      const child = normalizeValue(
        (value as Record<PropertyKey, any>)[symbol],
        seen,
        encodeSymbols,
      )
      setOwnProperty(result, encodeSymbols ? key : symbol, child)
    }
  }

  seen.delete(value)
  return result
}
