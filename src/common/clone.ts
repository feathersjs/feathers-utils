import { copy } from 'fast-copy'

/**
 * Deep-clones a value using `fast-copy`.
 *
 * Unlike a `JSON.parse(JSON.stringify(...))` round-trip, this correctly handles
 * `Date`, `Map`, `Set`, `RegExp`, typed arrays, `undefined` values and circular
 * references — all of which FeathersJS payloads routinely contain.
 *
 * @example
 * ```ts
 * const copyOf = clone({ name: 'Alice', createdAt: new Date(), nested: { value: 1 } })
 * ```
 */
export const clone = copy

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('clone', () => {
    it('deep-clones plain objects', () => {
      const input = { a: 1, nested: { b: 2 } }
      const out = clone(input)
      expect(out).toEqual(input)
      expect(out).not.toBe(input)
      expect(out.nested).not.toBe(input.nested)
    })

    it('preserves Date instances (not a JSON string)', () => {
      const date = new Date('2023-10-01T12:00:00Z')
      const out = clone({ date })
      expect(out.date).toBeInstanceOf(Date)
      expect(out.date.getTime()).toBe(date.getTime())
      expect(out.date).not.toBe(date)
    })

    it('preserves undefined values', () => {
      const out = clone({ a: undefined, b: 1 })
      expect('a' in out).toBe(true)
      expect(out.a).toBeUndefined()
    })

    it('handles arrays', () => {
      const input = [{ a: 1 }, { b: 2 }]
      const out = clone(input)
      expect(out).toEqual(input)
      expect(out[0]).not.toBe(input[0])
    })
  })
}
