import type { MergeQueryMode } from './merge-query.util.js'

/**
 * Merges two `$select` filters according to the mode: `combine` → union,
 * `intersect` → intersection, `target`/`source` → that side. When only one side
 * provides a `$select`, that one is used. Internal helper for {@link mergeQuery}.
 */
export function mergeSelect(
  target: any,
  source: any,
  mode: MergeQueryMode,
): any {
  if (target === undefined) {
    return source
  }
  if (source === undefined) {
    return target
  }
  if (mode === 'target') {
    return target
  }
  if (mode === 'source') {
    return source
  }
  const targetArr = Array.isArray(target) ? target : [target]
  const sourceArr = Array.isArray(source) ? source : [source]
  if (mode === 'combine') {
    return [...new Set([...targetArr, ...sourceArr])]
  }
  // intersect
  return targetArr.filter((value) => sourceArr.includes(value))
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('mergeSelect', () => {
    it('returns the defined side when one is missing', () => {
      expect(mergeSelect(undefined, ['a'], 'combine')).toEqual(['a'])
      expect(mergeSelect(['a'], undefined, 'combine')).toEqual(['a'])
    })

    it('unions on combine', () => {
      expect(mergeSelect(['a', 'b'], ['b', 'c'], 'combine')).toEqual([
        'a',
        'b',
        'c',
      ])
    })

    it('intersects on intersect', () => {
      expect(mergeSelect(['a', 'b'], ['b', 'c'], 'intersect')).toEqual(['b'])
    })

    it('can produce an empty intersection', () => {
      expect(mergeSelect(['a'], ['b'], 'intersect')).toEqual([])
    })

    it('picks the requested side on target / source', () => {
      expect(mergeSelect(['a'], ['b'], 'target')).toEqual(['a'])
      expect(mergeSelect(['a'], ['b'], 'source')).toEqual(['b'])
    })
  })
}
