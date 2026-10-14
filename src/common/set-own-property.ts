/**
 * Writes `value` as an own enumerable data property of `target`. A `__proto__`
 * key is defined instead of assigned, so a key that came in through
 * `JSON.parse` stays a key instead of replacing the prototype of `target`.
 *
 * @example
 * ```ts
 * const data = JSON.parse('{"__proto__": {"role": "admin"}}')
 * const copy = {}
 * for (const key in data) setOwnProperty(copy, key, data[key])
 * copy.role // => undefined
 * ```
 */
export const setOwnProperty = (
  target: Record<PropertyKey, any>,
  key: PropertyKey,
  value: unknown,
): void => {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  } else {
    target[key] = value
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('setOwnProperty', () => {
    it('assigns an ordinary key', () => {
      const target: Record<string, any> = {}
      setOwnProperty(target, 'a', 1)
      expect(target).toStrictEqual({ a: 1 })
    })

    it('keeps a `__proto__` key a key instead of replacing the prototype', () => {
      const target: Record<string, any> = {}
      setOwnProperty(target, '__proto__', { role: 'admin' })

      expect(Object.getPrototypeOf(target)).toBe(Object.prototype)
      expect(target.role).toBeUndefined()
      expect(Object.keys(target)).toStrictEqual(['__proto__'])
    })
  })
}
