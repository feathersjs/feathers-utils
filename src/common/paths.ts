/**
 * Helpers for dot-notation paths like `'address.city'`.
 */

/**
 * Whether `path` is `parent`, or lies within it - `'address.city'` lies
 * within `'address'`, `'addressee'` does not. Builds no strings.
 *
 * @example
 * ```ts
 * isPathWithin('address.city', 'address') // => true
 * isPathWithin('address', 'address.city') // => false
 * ```
 */
export const isPathWithin = (path: string, parent: string): boolean =>
  path.length === parent.length
    ? path === parent
    : path.length > parent.length &&
      path.charCodeAt(parent.length) === 46 && // '.'
      path.startsWith(parent)

/**
 * Whether two paths overlap: one is the other, or lies within it. A write to
 * either changes what the other reads.
 *
 * @example
 * ```ts
 * pathsOverlap('address', 'address.city') // => true
 * pathsOverlap('address.city', 'address.zip') // => false
 * ```
 */
export const pathsOverlap = (a: string, b: string): boolean =>
  isPathWithin(a, b) || isPathWithin(b, a)

/**
 * The top-level property a path lies within.
 *
 * @example
 * ```ts
 * topLevelKey('address.city') // => 'address'
 * topLevelKey('name') // => 'name'
 * ```
 */
export const topLevelKey = (path: string): string => {
  const dot = path.indexOf('.')
  return dot === -1 ? path : path.slice(0, dot)
}

/**
 * The top-level properties paths lie within, each once and in order.
 *
 * @example
 * ```ts
 * topLevelKeys(['address.city', 'address.zip', 'name']) // => ['address', 'name']
 * ```
 */
export const topLevelKeys = (paths: Iterable<string>): string[] => {
  const keys: string[] = []
  for (const path of paths) {
    const key = topLevelKey(path)
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

/**
 * Whether patch `data` changes one of the top-level `properties`. A key with a
 * dot counts as a change of the property it lies within - `'address.zip'`
 * changes `address`, even if only `address.city` matters.
 *
 * @example
 * ```ts
 * changesTopLevel({ name: 'a' }, new Set(['name', 'email'])) // => true
 * changesTopLevel({ 'address.zip': 1 }, new Set(['address'])) // => true
 * ```
 */
export const changesTopLevel = (
  data: Record<string, unknown>,
  properties: ReadonlySet<string>,
): boolean => {
  for (const key in data) {
    if (properties.has(topLevelKey(key))) return true
  }
  return false
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('isPathWithin', () => {
    it('is true for the path itself and paths within it', () => {
      expect(isPathWithin('a', 'a')).toBe(true)
      expect(isPathWithin('a.b', 'a')).toBe(true)
      expect(isPathWithin('a.b.c', 'a.b')).toBe(true)
    })

    it('is false for parents, siblings and mere prefixes of a segment', () => {
      expect(isPathWithin('a', 'a.b')).toBe(false)
      expect(isPathWithin('a.c', 'a.b')).toBe(false)
      expect(isPathWithin('ab', 'a')).toBe(false)
      expect(isPathWithin('a.bc', 'a.b')).toBe(false)
      expect(isPathWithin('b.a', 'a')).toBe(false)
    })
  })

  describe('pathsOverlap', () => {
    it('is true for equal paths and paths within each other', () => {
      expect(pathsOverlap('a', 'a')).toBe(true)
      expect(pathsOverlap('a', 'a.b')).toBe(true)
      expect(pathsOverlap('a.b.c', 'a.b')).toBe(true)
    })

    it('is false for siblings and mere prefixes of a segment', () => {
      expect(pathsOverlap('a.b', 'a.c')).toBe(false)
      expect(pathsOverlap('ab', 'a')).toBe(false)
      expect(pathsOverlap('a.bc', 'a.b')).toBe(false)
    })
  })

  describe('topLevelKey', () => {
    it('returns the first segment of a path', () => {
      expect(topLevelKey('a.b.c')).toBe('a')
      expect(topLevelKey('a')).toBe('a')
      expect(topLevelKey('')).toBe('')
    })
  })

  describe('topLevelKeys', () => {
    it('lists the top-level properties once, in order', () => {
      expect(topLevelKeys(['a.b', 'c', 'a.d', 'c.e'])).toEqual(['a', 'c'])
      expect(topLevelKeys([])).toEqual([])
    })
  })

  describe('changesTopLevel', () => {
    it('is true if a key is one of the properties, or lies within one', () => {
      const properties = new Set(['a', 'b'])

      expect(changesTopLevel({ a: 1 }, properties)).toBe(true)
      expect(changesTopLevel({ 'b.c': 1 }, properties)).toBe(true)
      expect(changesTopLevel({ c: 1, 'ca.b': 1 }, properties)).toBe(false)
      expect(changesTopLevel({}, properties)).toBe(false)
    })
  })
}
