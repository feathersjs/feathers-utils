import { isPathWithin } from './paths.js'

/**
 * Whether a query `$select` returns all of `paths`: there is none, so every
 * field is returned, or each path is in it - itself or a path it lies within,
 * since `$select: ['address']` returns the whole `address`. The `idField` is
 * always returned, as the adapters add it to any `$select`. A `$select` that
 * is not an array counts as one of a single field.
 *
 * @example
 * ```ts
 * selectCovers(undefined, ['name']) // => true
 * selectCovers(['address'], ['address.city']) // => true
 * selectCovers(['address.city'], ['address']) // => false
 * selectCovers(['name'], ['id', 'name'], 'id') // => true
 * ```
 */
export const selectCovers = (
  $select: unknown,
  paths: readonly string[],
  idField?: string,
): boolean => {
  if ($select == null) return true

  const selected = Array.isArray($select) ? $select : [$select]
  for (const path of paths) {
    if (path === idField) continue

    let found = false
    for (const field of selected) {
      if (isPathWithin(path, field)) {
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('selectCovers', () => {
    it('covers everything without a $select', () => {
      expect(selectCovers(undefined, ['a', 'b'])).toBe(true)
      expect(selectCovers(null, ['a'])).toBe(true)
    })

    it('covers the paths in the $select', () => {
      expect(selectCovers(['a', 'b'], ['b', 'a'])).toBe(true)
      expect(selectCovers(['a'], ['a', 'b'])).toBe(false)
      expect(selectCovers([], ['a'])).toBe(false)
      expect(selectCovers([], [])).toBe(true)
    })

    it('covers a path within a selected field, not the other way around', () => {
      expect(selectCovers(['a'], ['a.b'])).toBe(true)
      expect(selectCovers(['a.b'], ['a'])).toBe(false)
      expect(selectCovers(['a'], ['ab'])).toBe(false)
    })

    it('always covers the id field', () => {
      expect(selectCovers(['name'], ['id', 'name'], 'id')).toBe(true)
      expect(selectCovers([], ['_id'], '_id')).toBe(true)
      expect(selectCovers([], ['id'], '_id')).toBe(false)
      expect(selectCovers([], ['id'])).toBe(false)
    })

    it('reads a $select that is not an array as a single field', () => {
      expect(selectCovers('a', ['a'])).toBe(true)
      expect(selectCovers('a', ['b'])).toBe(false)
    })
  })
}
