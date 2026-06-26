import { describe, it, expect } from 'vitest'
import type { Query } from '@feathersjs/feathers'
import { mergeQuery, type MergeQueryOptions } from './merge-query.util.js'

type Pair = {
  target: Query
  source: Query
  options?: MergeQueryOptions
  expected: Query
}

const run = (pairs: Record<string, Pair>) => {
  for (const [name, { target, source, options, expected }] of Object.entries(
    pairs,
  )) {
    it(name, () => {
      expect(mergeQuery(target, source, options)).toEqual(expected)
    })
  }
}

describe('mergeQuery', () => {
  describe('general', () => {
    it('defaults to combine', () => {
      expect(mergeQuery({ id: 1 }, { id: 2 })).toEqual({
        $or: [{ id: 1 }, { id: 2 }],
      })
    })

    it('returns a new query and never mutates its inputs', () => {
      const cases: Array<{
        target: Query
        source: Query
        mode: 'combine' | 'intersect'
      }> = [
        {
          target: { price: { $gt: 5 }, $sort: { id: 1 } },
          source: { price: { $lt: 10 }, $sort: { name: -1 } },
          mode: 'combine',
        },
        {
          target: { $or: [{ id: 1 }, { id: 2 }] },
          source: { $or: [{ id: 2 }, { id: 3 }] },
          mode: 'combine',
        },
        {
          target: { $and: [{ id: 1 }] },
          source: { $and: [{ id: 2 }] },
          mode: 'intersect',
        },
      ]

      for (const { target, source, mode } of cases) {
        const targetSnapshot = structuredClone(target)
        const sourceSnapshot = structuredClone(source)

        const result = mergeQuery(target, source, { mode })

        expect(target).toEqual(targetSnapshot)
        expect(source).toEqual(sourceSnapshot)
        expect(result).not.toBe(target)
        expect(result).not.toBe(source)
      }
    })
  })

  describe('handle target / source', () => {
    run({
      'empty + empty': {
        target: {},
        source: {},
        options: { mode: 'target' },
        expected: {},
      },
      'target wins on conflict, adds source-only keys': {
        target: { id: 1, test1: true },
        source: { id: 2, test2: false },
        options: { mode: 'target' },
        expected: { id: 1, test1: true, test2: false },
      },
      'source wins on conflict, keeps target-only keys': {
        target: { id: 1, test1: true },
        source: { id: 2, test2: false },
        options: { mode: 'source' },
        expected: { id: 2, test1: true, test2: false },
      },
    })
  })

  describe('combine (default)', () => {
    run({
      'disjoint keys still become $or': {
        target: { a: 1 },
        source: { b: 2 },
        options: { mode: 'combine' },
        expected: { $or: [{ a: 1 }, { b: 2 }] },
      },
      'conflicting key becomes $or': {
        target: { id: 1 },
        source: { id: 2 },
        options: { mode: 'combine' },
        expected: { $or: [{ id: 1 }, { id: 2 }] },
      },
      'a shared equal key still becomes $or': {
        target: { id: 1, a: 2 },
        source: { id: 1, b: 3 },
        options: { mode: 'combine' },
        expected: {
          $or: [
            { id: 1, a: 2 },
            { id: 1, b: 3 },
          ],
        },
      },
      'identical bodies collapse': {
        target: { id: 1 },
        source: { id: 1 },
        options: { mode: 'combine' },
        expected: { id: 1 },
      },
      'unions $or branches': {
        target: { $or: [{ id: 1 }, { id: 2 }] },
        source: { $or: [{ id: 3 }] },
        options: { mode: 'combine' },
        expected: { $or: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      },
      'dedupes $or branches': {
        target: { $or: [{ id: 1 }, { id: 1 }, { id: 2 }] },
        source: { $or: [{ id: 2 }] },
        options: { mode: 'combine' },
        expected: { $or: [{ id: 1 }, { id: 2 }] },
      },
      '$and bodies become branches of an $or': {
        target: { $and: [{ id: 1 }, { id: 2 }] },
        source: { $and: [{ id: 3 }] },
        options: { mode: 'combine' },
        expected: {
          $or: [{ $and: [{ id: 1 }, { id: 2 }] }, { $and: [{ id: 3 }] }],
        },
      },
      'empty $or branches collapse to {}': {
        target: { $or: [{}] },
        source: { $or: [{}] },
        options: { mode: 'combine' },
        expected: {},
      },
      'conflicting operator objects become $or': {
        target: { price: { $gt: 5 } },
        source: { price: { $lt: 10 } },
        options: { mode: 'combine' },
        expected: { $or: [{ price: { $gt: 5 } }, { price: { $lt: 10 } }] },
      },
      'conflicting null becomes $or': {
        target: { a: null },
        source: { a: 1 },
        options: { mode: 'combine' },
        expected: { $or: [{ a: null }, { a: 1 }] },
      },
      'conflicting array values become $or': {
        target: { roles: ['a'] },
        source: { roles: ['b'] },
        options: { mode: 'combine' },
        expected: { $or: [{ roles: ['a'] }, { roles: ['b'] }] },
      },
      'an existing $or is extended by a plain query': {
        target: { $or: [{ id: 1 }] },
        source: { status: 'x' },
        options: { mode: 'combine' },
        expected: { $or: [{ id: 1 }, { status: 'x' }] },
      },
      'empty source returns target': {
        target: { id: 1 },
        source: {},
        options: { mode: 'combine' },
        expected: { id: 1 },
      },
      'empty target returns source': {
        target: {},
        source: { id: 1 },
        options: { mode: 'combine' },
        expected: { id: 1 },
      },
    })
  })

  describe('intersect', () => {
    run({
      'disjoint keys merge flat': {
        target: { id: 1 },
        source: { userId: 2 },
        options: { mode: 'intersect' },
        expected: { id: 1, userId: 2 },
      },
      'conflicting key becomes $and': {
        target: { id: 1 },
        source: { id: 2 },
        options: { mode: 'intersect' },
        expected: { $and: [{ id: 1 }, { id: 2 }] },
      },
      'unions $and branches': {
        target: { $and: [{ id: 1 }, { id: 2 }] },
        source: { $and: [{ id: 3 }] },
        options: { mode: 'intersect' },
        expected: { $and: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      },
      'dedupes $and branches': {
        target: { $and: [{ id: 1 }, { id: 1 }, { id: 2 }] },
        source: { $and: [{ id: 2 }] },
        options: { mode: 'intersect' },
        expected: { $and: [{ id: 1 }, { id: 2 }] },
      },
      '$or bodies become branches of an $and': {
        target: { $or: [{ id: 1 }, { id: 2 }] },
        source: { $or: [{ id: 3 }] },
        options: { mode: 'intersect' },
        expected: {
          $and: [{ $or: [{ id: 1 }, { id: 2 }] }, { $or: [{ id: 3 }] }],
        },
      },
      'subset (source ⊆ target) merges flat': {
        target: { id: 1, userId: 2 },
        source: { userId: 2 },
        options: { mode: 'intersect' },
        expected: { id: 1, userId: 2 },
      },
      'overlapping ranges become $and (no longer throws)': {
        target: { price: { $gt: 5 } },
        source: { price: { $gt: 8 } },
        options: { mode: 'intersect' },
        expected: { $and: [{ price: { $gt: 5 } }, { price: { $gt: 8 } }] },
      },
    })
  })

  describe('filters', () => {
    run({
      '$limit: -1 is preserved': {
        target: { $limit: -1 },
        source: { id: 1 },
        expected: { id: 1, $limit: -1 },
      },
      '$select is unioned on combine': {
        target: { $select: ['a', 'b'] },
        source: { $select: ['b', 'c'] },
        options: { mode: 'combine' },
        expected: { $select: ['a', 'b', 'c'] },
      },
      '$select is intersected on intersect': {
        target: { $select: ['a', 'b'] },
        source: { $select: ['b', 'c'] },
        options: { mode: 'intersect' },
        expected: { $select: ['b'] },
      },
      '$select intersection can be empty': {
        target: { $select: ['a'] },
        source: { $select: ['b'] },
        options: { mode: 'intersect' },
        expected: { $select: [] },
      },
      '$select from a single side is kept': {
        target: {},
        source: { $select: ['x'] },
        options: { mode: 'combine' },
        expected: { $select: ['x'] },
      },
      '$sort is deep-merged': {
        target: { $sort: { id: 1 } },
        source: { $sort: { name: -1 } },
        options: { mode: 'combine' },
        expected: { $sort: { id: 1, name: -1 } },
      },
      '$sort same key is overridden by source': {
        target: { $sort: { id: 1 } },
        source: { $sort: { id: -1 } },
        options: { mode: 'combine' },
        expected: { $sort: { id: -1 } },
      },
      '$limit is overridden by source': {
        target: { $limit: 10 },
        source: { $limit: 5 },
        options: { mode: 'combine' },
        expected: { $limit: 5 },
      },
      'target-only filters are kept': {
        target: { $limit: 50, $skip: 10, $sort: { id: 1 } },
        source: { id: 1 },
        options: { mode: 'intersect' },
        expected: { id: 1, $limit: 50, $skip: 10, $sort: { id: 1 } },
      },
      'source $limit overrides while other filters stay': {
        target: { $limit: 50, $skip: 10, $sort: { id: 1 } },
        source: { $limit: 10, id: 1 },
        options: { mode: 'intersect' },
        expected: { id: 1, $limit: 10, $skip: 10, $sort: { id: 1 } },
      },
    })
  })
})
