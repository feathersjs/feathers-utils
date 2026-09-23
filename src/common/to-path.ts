import type { PropertyPath } from '../types.js'

/**
 * One path segment: a bare key, a bracketed index (`[0]`) or a bracketed quoted
 * key (`["a.b"]`, `['a']`). Mirrors lodash's `rePropName`, so dot-notation paths
 * resolve exactly as they always have.
 */
const rePropName =
  /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g

/** Unescapes `\\` and `\"` inside a bracketed quoted key. */
const reEscapeChar = /\\(\\)?/g

/** A path that addresses something nested, i.e. contains a `.` or a `[...]`. */
const reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/

/** A path that is a single bare word, so it can never be nested. */
const reIsPlainProp = /^\w*$/

/** Matches an unsigned integer key, i.e. one that addresses an array index. */
export const reIsIndex = /^(?:0|[1-9]\d*)$/

/**
 * Normalizes one segment to the key used for property access. Numbers become
 * their string form, with `-0` kept distinct from `0`; symbols pass through.
 */
export const toKey = (value: unknown): PropertyKey => {
  if (typeof value === 'string' || typeof value === 'symbol') return value
  const result = `${value as any}`
  return result === '0' && 1 / (value as number) === -Infinity ? '-0' : result
}

/** Splits a string path into its segments. */
const stringToPath = (string: string): PropertyKey[] => {
  const result: PropertyKey[] = []
  if (string.charCodeAt(0) === 46 /* . */) result.push('')
  string.replace(rePropName, (match, number, quote, subString) => {
    result.push(
      quote
        ? subString.replace(reEscapeChar, '$1')
        : ((number || match) as string),
    )
    return match
  })
  return result
}

/**
 * Whether `value` addresses a single property rather than a nested path — which
 * includes a dotted string that exists verbatim as a key on `object`, so
 * `getPath({ 'a.b': 1 }, 'a.b')` finds that key instead of descending.
 */
const isKey = (value: unknown, object: unknown): boolean => {
  const type = typeof value
  if (
    type === 'number' ||
    type === 'symbol' ||
    type === 'boolean' ||
    value == null
  ) {
    return true
  }
  return (
    reIsPlainProp.test(value as string) ||
    !reIsDeepProp.test(value as string) ||
    (object != null && (value as string) in Object(object))
  )
}

/**
 * Splits a property path into its segments, without consulting a target object.
 *
 * @example
 * ```ts
 * toPath('a.b[0].c') // => ['a', 'b', '0', 'c']
 * toPath('a["b.c"]') // => ['a', 'b.c']
 * ```
 */
export const toPath = (value: PropertyPath): PropertyKey[] => {
  if (Array.isArray(value)) return value.map(toKey)
  if (typeof value === 'symbol') return [value]
  return stringToPath(`${value as any}`)
}

/**
 * Splits a property path into its segments **relative to `object`**: a dotted
 * string that `object` carries verbatim as a key stays one segment. This is what
 * the path reads and writes use, so a field literally named `'user.email'` keeps
 * working.
 *
 * @example
 * ```ts
 * castPath('a.b', {}) // => ['a', 'b']
 * castPath('a.b', { 'a.b': 1 }) // => ['a.b']
 * ```
 */
export const castPath = (
  value: PropertyPath,
  object: unknown,
): PropertyKey[] => {
  if (Array.isArray(value)) return value.map(toKey)
  return isKey(value, object) ? [toKey(value)] : stringToPath(`${value as any}`)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('toPath', () => {
    it.each([
      ['a.b.c', ['a', 'b', 'c']],
      ['a', ['a']],
      ['a..b', ['a', '', 'b']],
      ['.a.b', ['', 'a', 'b']],
      ['', []],
    ])('splits dot notation: %s', (path, expected) => {
      expect(toPath(path)).toEqual(expected)
    })

    it.each([
      ['a[0].b', ['a', '0', 'b']],
      ['a.0.b', ['a', '0', 'b']],
      ['a[-1]', ['a', '-1']],
      ['a[1.5]', ['a', '1.5']],
      ['a[]', ['a', '']],
    ])('splits bracket notation: %s', (path, expected) => {
      expect(toPath(path)).toEqual(expected)
    })

    it.each([
      ['a["b.c"].d', ['a', 'b.c', 'd']],
      ["a['b'].c", ['a', 'b', 'c']],
      ['a["b\\"c"]', ['a', 'b"c']],
    ])('keeps a quoted key whole: %s', (path, expected) => {
      expect(toPath(path)).toEqual(expected)
    })

    it('normalizes the segments of an array path', () => {
      expect(toPath(['a', 0, 'b'])).toEqual(['a', '0', 'b'])
    })

    it('keeps a symbol as one segment', () => {
      const sym = Symbol('s')
      expect(toPath(sym)).toEqual([sym])
    })

    it('does not consult an object — a dotted key is always split', () => {
      expect(toPath('a.b')).toEqual(['a', 'b'])
    })
  })

  describe('castPath', () => {
    it('splits a dotted path the object does not carry verbatim', () => {
      expect(castPath('a.b', {})).toEqual(['a', 'b'])
      expect(castPath('a.b.c', { a: { b: { c: 1 } } })).toEqual(['a', 'b', 'c'])
    })

    it('keeps a dotted key the object carries verbatim', () => {
      expect(castPath('a.b', { 'a.b': 1 })).toEqual(['a.b'])
    })

    it('passes a segment array through, normalized', () => {
      expect(castPath(['a', 0], {})).toEqual(['a', '0'])
    })

    it('treats a bare word or number as one segment', () => {
      expect(castPath('a', {})).toEqual(['a'])
      expect(castPath(0, {})).toEqual(['0'])
    })
  })

  describe('toKey', () => {
    it('keeps `-0` distinct from `0`', () => {
      expect(toKey(-0)).toBe('-0')
      expect(toKey(0)).toBe('0')
    })
  })
}
