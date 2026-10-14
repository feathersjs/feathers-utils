import { isEqual } from './is-equal.js'

/**
 * The bucket a non-primitive is compared in. Values that are equal share it, so
 * only the values of one bucket need the deep comparison:
 *
 * - a `Date` by its time,
 * - a mongo `ObjectId` (anything with `toHexString`) by its hex string,
 * - anything else by its constructor.
 */
const bucketOf = (value: object): unknown => {
  if (value instanceof Date) return `D${value.getTime()}`
  if (typeof (value as any).toHexString === 'function') {
    return `H${(value as any).toHexString()}`
  }
  return value.constructor
}

/**
 * Removes duplicates from a list of query values, preserving the order of first
 * occurrence. Primitives are compared with `SameValueZero` (`Set` semantics),
 * non-primitives with {@link isEqual} - so a `Date` or a mongo `ObjectId`
 * collapses even though they are distinct references, while other class
 * instances only collapse when they are the same instance.
 *
 * Primitives never hit the deep comparison, so the common case of a large list
 * of scalar ids stays a single `Set` pass. Non-primitives are only compared
 * within their bucket (see {@link bucketOf}), so a list of dates or ids stays
 * linear too.
 *
 * @internal shared by `eqOrIn` and `neOrNin`.
 */
export function dedupeValues<T>(values: readonly T[]): T[] {
  const seenPrimitives = new Set<T>()
  const buckets = new Map<unknown, T[]>()
  const result: T[] = []

  for (const value of values) {
    if (value !== null && typeof value === 'object') {
      const key = bucketOf(value)
      const bucket = buckets.get(key)
      if (!bucket) {
        buckets.set(key, [value])
      } else if (bucket.some((seen) => isEqual(seen, value))) {
        continue
      } else {
        bucket.push(value)
      }
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

    it('keeps class instances apart unless they are the same instance', () => {
      // their state may live in private fields, so equal looking instances
      // aren't necessarily equal
      class Id {
        constructor(public buffer: Uint8Array) {}
      }
      const id = new Id(new Uint8Array([1]))
      const values = [id, id, new Id(new Uint8Array([1]))]
      expect(dedupeValues(values)).toStrictEqual([id, values[2]])
    })

    it('keeps ObjectIds apart whose id deep equality cannot see', () => {
      // like bson 4: the id lives in a symbol key, no enumerable key is left
      const kId = Symbol('id')
      class ObjectId {
        [kId]: string
        constructor(hex: string) {
          this[kId] = hex
        }
        toHexString() {
          return this[kId]
        }
      }
      const a = new ObjectId('a1')
      const b = new ObjectId('b2')

      expect(dedupeValues([a, b, new ObjectId('a1')])).toStrictEqual([a, b])
    })

    it('keeps a date and an ObjectId apart from plain objects', () => {
      const date = new Date(5)
      const id = { toHexString: () => 'a1' }
      const plain = { id: 1 }

      expect(
        dedupeValues([date, id, plain, new Date(5), { id: 1 }]),
      ).toStrictEqual([date, id, plain])
    })

    it('keeps a date subclass apart from a date of the same time', () => {
      class Day extends Date {}
      const date = new Date(5)
      const day = new Day(5)

      expect(dedupeValues([date, day])).toStrictEqual([date, day])
    })

    it('dedupes objects without a prototype', () => {
      const a = Object.assign(Object.create(null), { id: 1 })
      const b = Object.assign(Object.create(null), { id: 1 })

      expect(dedupeValues([a, b])).toStrictEqual([a])
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
