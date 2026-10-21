import safeStringify from 'safe-stable-stringify'
import { isPlainObject, setOwnProperty } from '../../common/index.js'

const arrayOperators = new Set(['$or', '$and', '$nor', '$not', '$in', '$nin'])

const isEnumerable = Object.prototype.propertyIsEnumerable

/**
 * What `safeStringify` prints for `el` - the sort key of an array operator's
 * element - without its overhead for the primitives `$in`/`$nin` mostly hold.
 */
const sortKey = (el: unknown): string => {
  switch (typeof el) {
    case 'string':
      return JSON.stringify(el)
    case 'number':
      return Number.isFinite(el) ? String(el) : 'null'
    case 'boolean':
      return el ? 'true' : 'false'
    default:
      return el === null ? 'null' : (safeStringify(el) ?? '')
  }
}

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
  normalizeValue(value, {
    seen: [],
    encodeSymbols: options?.encodeSymbols ?? false,
    jsonSafe: true,
  })

/**
 * {@link normalize} with `encodeSymbols`, plus whether `JSON.stringify` of the
 * result prints exactly what `safe-stable-stringify` would — the fast path of
 * `stringifyParams`.
 *
 * @internal
 */
export const normalizeForStringify = (
  value: any,
): { value: any; jsonSafe: boolean } => {
  const state: State = { seen: [], encodeSymbols: true, jsonSafe: true }
  return { value: normalizeValue(value, state), jsonSafe: state.jsonSafe }
}

type State = {
  /** The plain objects on the current path, to stop at a cycle. */
  seen: object[]
  encodeSymbols: boolean
  /**
   * Cleared by anything the two serializers print differently, since only
   * `safe-stable-stringify` sorts keys while printing: a cycle, a BigInt, a
   * `toJSON` key, any object but a plain one, an array or a `Date` (a class
   * instance's keys are not sorted here), an encoded symbol key (it follows
   * the string keys) and an integer-like key (JS orders those first, and
   * numerically).
   */
  jsonSafe: boolean
}

/** A key JS orders before all others, the way it orders array indices. */
const isIndexLike = (key: string): boolean => {
  const code = key.charCodeAt(0)
  return code >= 48 && code <= 57 && /^(?:0|[1-9]\d*)$/.test(key)
}

const normalizeValue = (value: any, state: State): any => {
  if (Array.isArray(value)) {
    return value.map((el) => normalizeValue(el, state))
  }

  if (!isPlainObject(value)) {
    if (
      typeof value === 'bigint' ||
      (typeof value === 'object' && value !== null && !(value instanceof Date))
    ) {
      state.jsonSafe = false
    }
    return value
  }

  // the path is short, so a scan beats a `WeakSet`
  if (state.seen.includes(value)) {
    state.jsonSafe = false
    return value
  }
  state.seen.push(value)

  const result: Record<PropertyKey, any> = {}
  for (const key of Object.keys(value).sort()) {
    if (key === 'toJSON' || isIndexLike(key)) state.jsonSafe = false
    const child = normalizeValue(value[key], state)

    if (arrayOperators.has(key) && Array.isArray(child)) {
      // Schwartzian transform: serialize each normalized element once, sort by
      // that key, then unwrap. `safeStringify` keeps this crash-safe on cyclic
      // or otherwise non-serializable elements.
      result[key] = child
        .map((el) => ({ k: sortKey(el), v: el }))
        .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
        .map((entry) => entry.v)
    } else {
      // a `__proto__` key stays a key
      setOwnProperty(result, key, child)
    }
  }

  const symbols = Object.getOwnPropertySymbols(value)
  if (symbols.length) {
    if (state.encodeSymbols) state.jsonSafe = false
    const sorted = symbols
      .filter((symbol) => isEnumerable.call(value, symbol))
      .map((symbol) => ({ symbol, key: symbolKey(symbol) }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

    for (const { symbol, key } of sorted) {
      const child = normalizeValue(
        (value as Record<PropertyKey, any>)[symbol],
        state,
      )
      setOwnProperty(result, state.encodeSymbols ? key : symbol, child)
    }
  }

  state.seen.pop()
  return result
}
