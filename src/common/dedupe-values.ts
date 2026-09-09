import { dequal as deepEqual } from 'dequal'

/**
 * Removes duplicates from a list of query values, preserving the order of first
 * occurrence. Primitives are compared with `SameValueZero` (`Set` semantics),
 * non-primitives deep-equal — so value wrappers like `Date` or a mongo
 * `ObjectId` collapse even though they are distinct references.
 *
 * Primitives never hit the deep comparison, so the common case of a large list
 * of scalar ids stays a single `Set` pass; only the non-primitive elements are
 * compared pairwise against each other.
 *
 * @internal shared by `eqOrIn` and `neOrNin`.
 */
export function dedupeValues<T>(values: readonly T[]): T[] {
  const seenPrimitives = new Set<T>()
  const seenObjects: T[] = []
  const result: T[] = []

  for (const value of values) {
    if (value !== null && typeof value === 'object') {
      if (seenObjects.some((seen) => deepEqual(seen, value))) {
        continue
      }
      seenObjects.push(value)
    } else {
      if (seenPrimitives.has(value)) {
        continue
      }
      seenPrimitives.add(value)
    }

    result.push(value)
  }

  return result
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('dedupeValues', () => {
    it('dedupes primitives, preserving first-occurrence order', () => {
      expect(dedupeValues([3, 1, 3, 2, 1])).toEqual([3, 1, 2])
    })

    it('treats NaN as equal to itself', () => {
      expect(dedupeValues([NaN, NaN])).toEqual([NaN])
    })

    it('dedupes null and undefined as regular values', () => {
      expect(dedupeValues([null, undefined, null, undefined])).toEqual([
        null,
        undefined,
      ])
    })

    it('dedupes deep-equal objects across references', () => {
      expect(dedupeValues([{ id: 1 }, { id: 1 }, { id: 2 }])).toEqual([
        { id: 1 },
        { id: 2 },
      ])
    })

    it('dedupes equal dates', () => {
      const values = [new Date(5), new Date(5), new Date(6)]
      expect(dedupeValues(values)).toEqual([new Date(5), new Date(6)])
    })

    it('dedupes equal class instances by value', () => {
      class Id {
        constructor(public buffer: Uint8Array) {}
      }
      const values = [
        new Id(new Uint8Array([1])),
        new Id(new Uint8Array([1])),
        new Id(new Uint8Array([2])),
      ]
      expect(dedupeValues(values)).toHaveLength(2)
    })

    it('does not mutate the input', () => {
      const values = [1, 1, 2]
      dedupeValues(values)
      expect(values).toEqual([1, 1, 2])
    })

    it('returns an empty array unchanged', () => {
      expect(dedupeValues([])).toEqual([])
    })
  })
}
