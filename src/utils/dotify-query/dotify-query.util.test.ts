import { describe, it, expect } from 'vitest'
import { dotifyQuery } from './dotify-query.util.js'

describe('dotifyQuery', () => {
  describe('basic conversion', () => {
    it('flattens a one-level nested property', () => {
      expect(dotifyQuery({ user: { name: 'x' } })).toEqual({ 'user.name': 'x' })
    })

    it('flattens a multi-level nested property', () => {
      expect(dotifyQuery({ company: { owner: { name: 'x' } } })).toEqual({
        'company.owner.name': 'x',
      })
    })

    it('flattens several siblings', () => {
      expect(dotifyQuery({ user: { name: 'x', age: 5 } })).toEqual({
        'user.name': 'x',
        'user.age': 5,
      })
    })

    it('keeps already-dotted keys and appends to them', () => {
      expect(dotifyQuery({ 'a.b': { c: 1 } })).toEqual({ 'a.b.c': 1 })
    })

    it('leaves a flat query untouched', () => {
      expect(dotifyQuery({ id: 1, name: 'x' })).toEqual({ id: 1, name: 'x' })
    })
  })

  describe('operators', () => {
    it('keeps an operator object as a leaf', () => {
      expect(dotifyQuery({ user: { name: { $ne: 'x' } } })).toEqual({
        'user.name': { $ne: 'x' },
      })
    })

    it('does not descend into an operator object', () => {
      expect(dotifyQuery({ age: { $gt: 18, $lt: 30 } })).toEqual({
        age: { $gt: 18, $lt: 30 },
      })
    })

    it('splits a mixed operator/property object', () => {
      expect(dotifyQuery({ user: { $ne: null, name: 'x' } })).toEqual({
        user: { $ne: null },
        'user.name': 'x',
      })
    })

    it('keeps $in arrays as values', () => {
      expect(dotifyQuery({ user: { role: { $in: ['a', 'b'] } } })).toEqual({
        'user.role': { $in: ['a', 'b'] },
      })
    })
  })

  describe('branch operators', () => {
    it('converts inside $or', () => {
      expect(dotifyQuery({ $or: [{ user: { name: 'a' } }] })).toEqual({
        $or: [{ 'user.name': 'a' }],
      })
    })

    it('converts inside $and', () => {
      expect(
        dotifyQuery({ $and: [{ user: { name: 'a' } }, { id: 1 }] }),
      ).toEqual({ $and: [{ 'user.name': 'a' }, { id: 1 }] })
    })

    it('converts inside $nor', () => {
      expect(dotifyQuery({ $nor: [{ user: { name: 'a' } }] })).toEqual({
        $nor: [{ 'user.name': 'a' }],
      })
    })

    it('converts inside nested branches ($or > $and)', () => {
      expect(
        dotifyQuery({ $or: [{ $and: [{ user: { name: 'a' } }] }] }),
      ).toEqual({ $or: [{ $and: [{ 'user.name': 'a' }] }] })
    })

    it('does not prefix branch keys with the operator', () => {
      const result = dotifyQuery({ $or: [{ user: { name: 'a' } }] })
      expect(Object.keys(result)).toEqual(['$or'])
    })

    it('leaves non-object branch entries alone', () => {
      expect(dotifyQuery({ $or: [null, { user: { name: 'a' } }] })).toEqual({
        $or: [null, { 'user.name': 'a' }],
      })
    })

    it('converts $not given as an array of branches', () => {
      expect(dotifyQuery({ $not: [{ user: { name: 'a' } }] } as any)).toEqual({
        $not: [{ 'user.name': 'a' }],
      })
    })

    it('converts $not given as a single sub-query', () => {
      expect(dotifyQuery({ $not: { user: { name: 'a' } } } as any)).toEqual({
        $not: { 'user.name': 'a' },
      })
    })

    it('leaves a scalar $not alone', () => {
      expect(dotifyQuery({ $not: 1 } as any)).toEqual({ $not: 1 })
    })
  })

  describe('filters', () => {
    it('flattens $sort keys', () => {
      expect(dotifyQuery({ $sort: { user: { name: 1 } } })).toEqual({
        $sort: { 'user.name': 1 },
      })
    })

    it('keeps $sort directions and already-dotted keys', () => {
      expect(dotifyQuery({ $sort: { 'user.name': -1, createdAt: 1 } })).toEqual(
        { $sort: { 'user.name': -1, createdAt: 1 } },
      )
    })

    it('leaves a non-object $sort alone', () => {
      expect(dotifyQuery({ $sort: 'name' } as any)).toEqual({ $sort: 'name' })
    })

    it('leaves $select untouched', () => {
      expect(dotifyQuery({ $select: ['user.name'] })).toEqual({
        $select: ['user.name'],
      })
    })

    it('leaves $limit and $skip untouched', () => {
      expect(dotifyQuery({ $limit: 10, $skip: 5 })).toEqual({
        $limit: 10,
        $skip: 5,
      })
    })

    it('leaves a custom top-level operator untouched', () => {
      expect(dotifyQuery({ $fuzzy: { term: 'x' } } as any)).toEqual({
        $fuzzy: { term: 'x' },
      })
    })
  })

  describe('non-descendable values', () => {
    it('leaves a Date alone', () => {
      const at = new Date()
      expect(dotifyQuery({ at })).toEqual({ at })
    })

    it('leaves a RegExp alone', () => {
      const re = /x/
      expect(dotifyQuery({ name: re })).toEqual({ name: re })
    })

    it('leaves an array alone', () => {
      expect(dotifyQuery({ tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] })
    })

    it('leaves an array of objects alone', () => {
      expect(dotifyQuery({ tags: [{ a: 1 }] })).toEqual({ tags: [{ a: 1 }] })
    })

    it('leaves null and primitives alone', () => {
      expect(dotifyQuery({ a: null, b: 1, c: 'x', d: false })).toEqual({
        a: null,
        b: 1,
        c: 'x',
        d: false,
      })
    })

    it('leaves an empty object alone', () => {
      expect(dotifyQuery({ user: {} })).toEqual({ user: {} })
    })

    it('returns a non-object query as-is', () => {
      expect(dotifyQuery(null as any)).toBe(null)
    })
  })

  describe('descend predicate', () => {
    it('false stops the descent', () => {
      expect(dotifyQuery({ meta: { a: 1 } }, { descend: () => false })).toEqual(
        { meta: { a: 1 } },
      )
    })

    it('true forces the descent of an operator-only object', () => {
      expect(
        dotifyQuery({ user: { $ne: 1 } }, { descend: () => true }),
      ).toEqual({ user: { $ne: 1 } })
    })

    it('undefined falls through to the default heuristic', () => {
      expect(
        dotifyQuery({ user: { name: 'x' } }, { descend: () => undefined }),
      ).toEqual({ 'user.name': 'x' })
    })

    it('receives key, path and value', () => {
      const seen: { key: string; path: string; value: any }[] = []
      dotifyQuery(
        { company: { owner: { name: 'x' } } },
        {
          descend: (options) => {
            seen.push({ ...options })
            return undefined
          },
        },
      )
      expect(seen).toEqual([
        { key: 'company', path: 'company', value: { owner: { name: 'x' } } },
        { key: 'owner', path: 'company.owner', value: { name: 'x' } },
      ])
    })

    it('is not called for leaf values', () => {
      let calls = 0
      dotifyQuery(
        { id: 1, at: new Date(), user: {}, age: { $gt: 1 } },
        {
          descend: () => {
            calls++
            return undefined
          },
        },
      )
      expect(calls).toBe(1) // only `age`, the only non-empty plain object
    })

    it('takes precedence over exclude', () => {
      expect(
        dotifyQuery(
          { user: { name: 'x' } },
          { exclude: ['user'], descend: () => true },
        ),
      ).toEqual({ 'user.name': 'x' })
    })

    it('takes precedence over include', () => {
      expect(
        dotifyQuery(
          { user: { name: 'x' } },
          { include: ['other'], descend: () => true },
        ),
      ).toEqual({ 'user.name': 'x' })
    })

    it('supports depth-agnostic key matching', () => {
      expect(
        dotifyQuery(
          { user: { meta: { a: 1 }, name: 'x' } },
          { descend: ({ key }) => (key === 'meta' ? false : undefined) },
        ),
      ).toEqual({ 'user.meta': { a: 1 }, 'user.name': 'x' })
    })
  })

  describe('exclude / include', () => {
    it('excludes a top-level key', () => {
      expect(dotifyQuery({ meta: { a: 1 } }, { exclude: ['meta'] })).toEqual({
        meta: { a: 1 },
      })
    })

    it('excludes a deep path only', () => {
      expect(
        dotifyQuery(
          { user: { meta: { a: 1 }, name: 'x' } },
          { exclude: ['user.meta'] },
        ),
      ).toEqual({ 'user.meta': { a: 1 }, 'user.name': 'x' })
    })

    it('does not match a deep path by its bare key', () => {
      expect(
        dotifyQuery({ user: { meta: { a: 1 } } }, { exclude: ['meta'] }),
      ).toEqual({ 'user.meta.a': 1 })
    })

    it('include restricts the conversion to the listed paths', () => {
      expect(
        dotifyQuery(
          { user: { name: 'x' }, meta: { a: 1 } },
          { include: ['user'] },
        ),
      ).toEqual({ 'user.name': 'x', meta: { a: 1 } })
    })

    it('include has to list every level of a deep path', () => {
      expect(
        dotifyQuery(
          { company: { owner: { name: 'x' } } },
          { include: ['company'] },
        ),
      ).toEqual({ 'company.owner': { name: 'x' } })

      expect(
        dotifyQuery(
          { company: { owner: { name: 'x' } } },
          { include: ['company', 'company.owner'] },
        ),
      ).toEqual({ 'company.owner.name': 'x' })
    })
  })

  describe('collisions', () => {
    it('merges two operator objects for the same path', () => {
      expect(
        dotifyQuery({
          'user.name': { $ne: 'a' },
          user: { name: { $gt: 'b' } },
        }),
      ).toEqual({ 'user.name': { $ne: 'a', $gt: 'b' } })
    })

    it('collapses deep-equal values for the same path', () => {
      expect(dotifyQuery({ 'user.name': 'a', user: { name: 'a' } })).toEqual({
        'user.name': 'a',
      })
    })

    it('collapses deep-equal operator objects', () => {
      expect(
        dotifyQuery({
          'user.role': { $in: ['a'] },
          user: { role: { $in: ['a'] } },
        }),
      ).toEqual({ 'user.role': { $in: ['a'] } })
    })

    it('wraps contradictory scalar values in $and', () => {
      expect(dotifyQuery({ 'user.name': 'a', user: { name: 'b' } })).toEqual({
        'user.name': 'a',
        $and: [{ 'user.name': 'b' }],
      })
    })

    it('wraps overlapping operator objects in $and', () => {
      expect(
        dotifyQuery({
          'user.name': { $ne: 'a' },
          user: { name: { $ne: 'b' } },
        }),
      ).toEqual({
        'user.name': { $ne: 'a' },
        $and: [{ 'user.name': { $ne: 'b' } }],
      })
    })

    it('wraps a scalar colliding with an operator object in $and', () => {
      expect(
        dotifyQuery({ 'user.name': 'a', user: { name: { $ne: 'b' } } }),
      ).toEqual({ 'user.name': 'a', $and: [{ 'user.name': { $ne: 'b' } }] })
    })

    it('appends to an existing $and regardless of key order', () => {
      const expected = {
        'user.name': 'a',
        $and: [{ x: 1 }, { 'user.name': 'b' }],
      }

      // `$and` before the colliding keys
      expect(
        dotifyQuery({
          $and: [{ x: 1 }],
          'user.name': 'a',
          user: { name: 'b' },
        }),
      ).toEqual(expected)

      // `$and` after the colliding keys
      expect(
        dotifyQuery({
          'user.name': 'a',
          user: { name: 'b' },
          $and: [{ x: 1 }],
        }),
      ).toEqual(expected)
    })

    it('does not duplicate a branch already present in $and', () => {
      expect(
        dotifyQuery({
          $and: [{ 'user.name': 'b' }],
          'user.name': 'a',
          user: { name: 'b' },
        }),
      ).toEqual({ 'user.name': 'a', $and: [{ 'user.name': 'b' }] })
    })

    it('wraps a leaf colliding with an already-flattened path in $and', () => {
      // reverse key order: the nested object is flattened first, then the
      // dotted leaf collides with it
      expect(dotifyQuery({ user: { name: 'b' }, 'user.name': 'a' })).toEqual({
        'user.name': 'b',
        $and: [{ 'user.name': 'a' }],
      })
    })

    it('wraps colliding operators of a mixed object in $and', () => {
      expect(dotifyQuery({ a: { b: 3 }, 'a.b': { $ne: 1, c: 2 } })).toEqual({
        'a.b': 3,
        'a.b.c': 2,
        $and: [{ 'a.b': { $ne: 1 } }],
      })
    })

    it('hoists a conflict from a nested object to the enclosing level', () => {
      expect(dotifyQuery({ user: { 'a.b': 1, a: { b: 2 } } })).toEqual({
        'user.a.b': 1,
        $and: [{ 'user.a.b': 2 }],
      })
    })

    it('keeps a conflict inside the $or branch it came from', () => {
      expect(
        dotifyQuery({ $or: [{ 'user.name': 'a', user: { name: 'b' } }] }),
      ).toEqual({
        $or: [{ 'user.name': 'a', $and: [{ 'user.name': 'b' }] }],
      })
    })
  })

  describe('immutability', () => {
    it('returns the identical object when nothing changed', () => {
      const query = { id: 1, age: { $gt: 18 }, $limit: 10 }
      expect(dotifyQuery(query)).toBe(query)
    })

    it('does not mutate the input', () => {
      const query = { user: { name: 'x' }, $or: [{ user: { age: 1 } }] }
      const snapshot = structuredClone(query)
      dotifyQuery(query)
      expect(query).toEqual(snapshot)
    })
  })
})
