import { describe, it, expect } from 'vitest'
import { nestifyQuery } from './nestify-query.util.js'
import { dotifyQuery } from '../dotify-query/dotify-query.util.js'

describe('nestifyQuery', () => {
  describe('basic conversion', () => {
    it('nests a one-level dotted key', () => {
      expect(nestifyQuery({ 'user.name': 'x' })).toEqual({
        user: { name: 'x' },
      })
    })

    it('nests a multi-level dotted key', () => {
      expect(nestifyQuery({ 'company.owner.name': 'x' })).toEqual({
        company: { owner: { name: 'x' } },
      })
    })

    it('merges sibling dotted keys into one object', () => {
      expect(
        nestifyQuery({ 'user.name': 'a', 'user.age': { $gt: 18 } }),
      ).toEqual({ user: { name: 'a', age: { $gt: 18 } } })
    })

    it('keeps an operator object as a leaf', () => {
      expect(nestifyQuery({ 'user.name': { $ne: 'x' } })).toEqual({
        user: { name: { $ne: 'x' } },
      })
    })

    it('leaves a flat query untouched', () => {
      expect(nestifyQuery({ id: 1, age: { $gt: 18 } })).toEqual({
        id: 1,
        age: { $gt: 18 },
      })
    })

    it('nests dotted keys found inside an already-nested object', () => {
      expect(nestifyQuery({ user: { 'address.city': 'x' } })).toEqual({
        user: { address: { city: 'x' } },
      })
    })

    it('never splits a path containing a $ segment', () => {
      expect(nestifyQuery({ 'user.$ne': 1 } as any)).toEqual({ 'user.$ne': 1 })
    })
  })

  describe('branch operators', () => {
    it('converts inside $or', () => {
      expect(nestifyQuery({ $or: [{ 'user.name': 'a' }] })).toEqual({
        $or: [{ user: { name: 'a' } }],
      })
    })

    it('converts inside $and', () => {
      expect(nestifyQuery({ $and: [{ 'user.name': 'a' }, { id: 1 }] })).toEqual(
        {
          $and: [{ user: { name: 'a' } }, { id: 1 }],
        },
      )
    })

    it('converts inside $nor', () => {
      expect(nestifyQuery({ $nor: [{ 'user.name': 'a' }] })).toEqual({
        $nor: [{ user: { name: 'a' } }],
      })
    })

    it('converts inside nested branches ($or > $and)', () => {
      expect(nestifyQuery({ $or: [{ $and: [{ 'user.name': 'a' }] }] })).toEqual(
        { $or: [{ $and: [{ user: { name: 'a' } }] }] },
      )
    })

    it('leaves non-object branch entries alone', () => {
      expect(nestifyQuery({ $or: [null, { 'user.name': 'a' }] })).toEqual({
        $or: [null, { user: { name: 'a' } }],
      })
    })

    it('converts $not given as an array of branches', () => {
      expect(nestifyQuery({ $not: [{ 'user.name': 'a' }] } as any)).toEqual({
        $not: [{ user: { name: 'a' } }],
      })
    })

    it('converts $not given as a single sub-query', () => {
      expect(nestifyQuery({ $not: { 'user.name': 'a' } } as any)).toEqual({
        $not: { user: { name: 'a' } },
      })
    })

    it('leaves a scalar $not alone', () => {
      expect(nestifyQuery({ $not: 1 } as any)).toEqual({ $not: 1 })
    })
  })

  describe('filters', () => {
    it('keeps dotted $sort keys as-is', () => {
      expect(nestifyQuery({ $sort: { 'user.name': 1 } })).toEqual({
        $sort: { 'user.name': 1 },
      })
    })

    it('flattens nested $sort keys instead of nesting them', () => {
      expect(nestifyQuery({ $sort: { user: { name: -1 } } })).toEqual({
        $sort: { 'user.name': -1 },
      })
    })

    it('leaves a non-object $sort alone', () => {
      expect(nestifyQuery({ $sort: 'name' } as any)).toEqual({ $sort: 'name' })
    })

    it('leaves $select untouched', () => {
      expect(nestifyQuery({ $select: ['user.name'] })).toEqual({
        $select: ['user.name'],
      })
    })

    it('leaves $limit and $skip untouched', () => {
      expect(nestifyQuery({ $limit: 10, $skip: 5 })).toEqual({
        $limit: 10,
        $skip: 5,
      })
    })

    it('leaves a custom top-level operator untouched', () => {
      expect(nestifyQuery({ $fuzzy: { 'a.b': 'x' } } as any)).toEqual({
        $fuzzy: { 'a.b': 'x' },
      })
    })
  })

  describe('non-splittable values', () => {
    it('leaves a Date alone', () => {
      const at = new Date()
      expect(nestifyQuery({ 'user.at': at })).toEqual({ user: { at } })
    })

    it('leaves an array alone', () => {
      expect(nestifyQuery({ 'user.tags': ['a'] })).toEqual({
        user: { tags: ['a'] },
      })
    })

    it('leaves null and primitives alone', () => {
      expect(nestifyQuery({ a: null, b: 1, c: false })).toEqual({
        a: null,
        b: 1,
        c: false,
      })
    })

    it('returns a non-object query as-is', () => {
      expect(nestifyQuery(null as any)).toBe(null)
    })
  })

  describe('split predicate', () => {
    it('false keeps the key as-is', () => {
      expect(nestifyQuery({ 'a.b': 1 }, { split: () => false })).toEqual({
        'a.b': 1,
      })
    })

    it('true forces the split of a $-containing path', () => {
      expect(
        nestifyQuery({ 'user.$ne': 1 } as any, { split: () => true }),
      ).toEqual({ user: { $ne: 1 } })
    })

    it('undefined falls through to the default heuristic', () => {
      expect(nestifyQuery({ 'a.b': 1 }, { split: () => undefined })).toEqual({
        a: { b: 1 },
      })
    })

    it('receives key, path and value', () => {
      const seen: { key: string; path: string; value: any }[] = []
      nestifyQuery(
        { user: { 'address.city': 'x' } },
        {
          split: (options) => {
            seen.push({ ...options })
            return undefined
          },
        },
      )
      expect(seen).toEqual([
        { key: 'address.city', path: 'user.address.city', value: 'x' },
      ])
    })

    it('is not called for keys without a dot', () => {
      let calls = 0
      nestifyQuery(
        { id: 1, user: { name: 'x' } },
        {
          split: () => {
            calls++
            return undefined
          },
        },
      )
      expect(calls).toBe(0)
    })

    it('takes precedence over exclude', () => {
      expect(
        nestifyQuery({ 'a.b': 1 }, { exclude: ['a.b'], split: () => true }),
      ).toEqual({ a: { b: 1 } })
    })

    it('takes precedence over include', () => {
      expect(
        nestifyQuery({ 'a.b': 1 }, { include: ['other'], split: () => true }),
      ).toEqual({ a: { b: 1 } })
    })
  })

  describe('exclude / include', () => {
    it('excludes a top-level key', () => {
      expect(
        nestifyQuery({ 'x.y': 1, 'a.b': 2 }, { exclude: ['x.y'] }),
      ).toEqual({ 'x.y': 1, a: { b: 2 } })
    })

    it('excludes a deep path', () => {
      expect(
        nestifyQuery(
          { user: { 'a.b': 1, 'c.d': 2 } },
          { exclude: ['user.a.b'] },
        ),
      ).toEqual({ user: { 'a.b': 1, c: { d: 2 } } })
    })

    it('include restricts the conversion to the listed paths', () => {
      expect(
        nestifyQuery({ 'a.b': 1, 'x.y': 2 }, { include: ['a.b'] }),
      ).toEqual({ a: { b: 1 }, 'x.y': 2 })
    })
  })

  describe('collisions', () => {
    it('merges a dotted key into an existing object', () => {
      expect(nestifyQuery({ 'user.name': 'a', user: { age: 1 } })).toEqual({
        user: { name: 'a', age: 1 },
      })
    })

    it('collapses deep-equal values for the same path', () => {
      expect(nestifyQuery({ 'user.name': 'a', user: { name: 'a' } })).toEqual({
        user: { name: 'a' },
      })
    })

    it('keeps the dotted key when the path is blocked by a scalar', () => {
      // no `$and` needed — the dotted key is already a valid condition
      const query = { user: 5, 'user.name': 'a' }
      expect(nestifyQuery(query)).toEqual({ user: 5, 'user.name': 'a' })
      expect(nestifyQuery(query)).toBe(query)
    })

    it('keeps the dotted key when a deeper segment is blocked', () => {
      expect(nestifyQuery({ 'a.b': 5, 'a.b.c': 1 })).toEqual({
        a: { b: 5 },
        'a.b.c': 1,
      })
    })

    it('wraps contradictory values for the same path in $and', () => {
      expect(nestifyQuery({ 'user.name': 'a', user: { name: 'b' } })).toEqual({
        user: { name: 'a' },
        $and: [{ user: { name: 'b' } }],
      })
    })

    it('wraps a dotted key colliding with an existing leaf in $and', () => {
      // reverse key order: `user` is nested first, so the split of `user.name`
      // is the side that hits the conflict
      expect(nestifyQuery({ user: { name: 'b' }, 'user.name': 'a' })).toEqual({
        user: { name: 'b' },
        $and: [{ user: { name: 'a' } }],
      })
    })

    it('appends to an existing $and regardless of key order', () => {
      const expected = {
        user: { name: 'a' },
        $and: [{ x: 1 }, { user: { name: 'b' } }],
      }

      expect(
        nestifyQuery({
          $and: [{ x: 1 }],
          'user.name': 'a',
          user: { name: 'b' },
        }),
      ).toEqual(expected)

      expect(
        nestifyQuery({
          'user.name': 'a',
          user: { name: 'b' },
          $and: [{ x: 1 }],
        }),
      ).toEqual(expected)
    })

    it('does not duplicate a branch already present in $and', () => {
      expect(
        nestifyQuery({
          $and: [{ user: { name: 'b' } }],
          'user.name': 'a',
          user: { name: 'b' },
        }),
      ).toEqual({ user: { name: 'a' }, $and: [{ user: { name: 'b' } }] })
    })

    it('hoists a conflict out of a property value, re-keyed', () => {
      expect(nestifyQuery({ user: { 'a.b': 1, a: { b: 2 } } })).toEqual({
        user: { a: { b: 1 } },
        $and: [{ user: { a: { b: 2 } } }],
      })
    })

    it('hoists a conflict out of a dotted property value, re-keyed', () => {
      expect(nestifyQuery({ 'x.user': { 'a.b': 1, a: { b: 2 } } })).toEqual({
        x: { user: { a: { b: 1 } } },
        $and: [{ x: { user: { a: { b: 2 } } } }],
      })
    })

    it('keeps a conflict inside the $or branch it came from', () => {
      expect(
        nestifyQuery({ $or: [{ 'user.name': 'a', user: { name: 'b' } }] }),
      ).toEqual({
        $or: [{ user: { name: 'a' }, $and: [{ user: { name: 'b' } }] }],
      })
    })
  })

  describe('immutability', () => {
    it('returns the identical object when nothing changed', () => {
      const query = { id: 1, user: { name: 'a' }, $limit: 10 }
      expect(nestifyQuery(query)).toBe(query)
    })

    it('does not mutate the input', () => {
      const query = {
        'user.name': 'a',
        user: { age: 1 },
        $or: [{ 'a.b': 1 }],
      }
      const snapshot = structuredClone(query)
      nestifyQuery(query)
      expect(query).toEqual(snapshot)
    })
  })

  describe('round-trip with dotifyQuery', () => {
    const corpus = [
      { id: 1 },
      { 'user.name': 'x' },
      { user: { name: 'x' } },
      { 'user.name': { $ne: 'x' } },
      { 'company.owner.name': 'x', 'company.id': 2 },
      { $or: [{ 'user.name': 'a' }, { 'user.age': { $gt: 18 } }] },
      { $and: [{ $or: [{ 'a.b.c': 1 }] }, { d: 2 }] },
      { $sort: { 'user.name': 1 }, $select: ['user.name'], $limit: 10 },
      { at: new Date(0), tags: ['a'], empty: {} },
      { 'user.name': 'a', user: { name: 'b' } },
      { user: 5, 'user.name': 'a' },
      { 'a.b': 5, 'a.b.c': 1 },
    ]

    it.each(corpus)('dotify(nestify(q)) === dotify(q) for %j', (query) => {
      expect(dotifyQuery(nestifyQuery(query as any))).toEqual(
        dotifyQuery(query as any),
      )
    })

    it('dotify is idempotent', () => {
      for (const query of corpus) {
        const once = dotifyQuery(query as any)
        expect(dotifyQuery(once)).toEqual(once)
      }
    })

    it('nestify is idempotent', () => {
      for (const query of corpus) {
        const once = nestifyQuery(query as any)
        expect(nestifyQuery(once)).toEqual(once)
      }
    })
  })
})
