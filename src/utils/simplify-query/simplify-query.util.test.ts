import { describe, it, expect } from 'vitest'
import { simplifyQuery } from './simplify-query.util.js'

describe('simplifyQuery', () => {
  it('returns falsy queries as-is', () => {
    expect(simplifyQuery(null)).toBe(null)
    expect(simplifyQuery(undefined)).toBe(undefined)
  })

  it('returns a query without $and/$or unchanged (same reference)', () => {
    const query = { id: 1, status: 'active' }
    expect(simplifyQuery(query)).toBe(query)
  })

  it('drops an empty $and', () => {
    expect(simplifyQuery({ id: 1, $and: [] })).toEqual({ id: 1 })
  })

  it('drops an empty $or', () => {
    expect(simplifyQuery({ id: 1, $or: [] })).toEqual({ id: 1 })
  })

  it('drops a $or that contains an (always-true) empty branch', () => {
    expect(simplifyQuery({ id: 1, $or: [{}, { a: 1 }] })).toEqual({ id: 1 })
  })

  it('collapses a single-branch $and to that branch', () => {
    expect(simplifyQuery({ $and: [{ id: 1 }] })).toEqual({ id: 1 })
  })

  it('collapses a single-branch $or to that branch', () => {
    expect(simplifyQuery({ $or: [{ id: 1 }] })).toEqual({ id: 1 })
  })

  it('merges a single-branch $and up when keys do not collide', () => {
    expect(simplifyQuery({ status: 'a', $and: [{ id: 1 }] })).toEqual({
      status: 'a',
      id: 1,
    })
  })

  it('keeps the wrapper when merging a single branch up would collide', () => {
    expect(simplifyQuery({ id: 2, $and: [{ id: 1 }] })).toEqual({
      id: 2,
      $and: [{ id: 1 }],
    })
  })

  it('merges a single $and branch that carries an $or up', () => {
    expect(
      simplifyQuery({ status: 'a', $and: [{ $or: [{ x: 1 }, { y: 2 }] }] }),
    ).toEqual({ status: 'a', $or: [{ x: 1 }, { y: 2 }] })
  })

  it('respects replaceAnd: false / replaceOr: false at the top level', () => {
    expect(simplifyQuery({ $and: [{ id: 1 }] }, { replaceAnd: false })).toEqual(
      {
        $and: [{ id: 1 }],
      },
    )
    expect(simplifyQuery({ $or: [{ id: 1 }] }, { replaceOr: false })).toEqual({
      $or: [{ id: 1 }],
    })
  })

  it('dedupes $and and $or branches', () => {
    expect(simplifyQuery({ $and: [{ id: 1 }, { id: 1 }, { id: 2 }] })).toEqual({
      $and: [{ id: 1 }, { id: 2 }],
    })
    expect(simplifyQuery({ $or: [{ id: 1 }, { id: 1 }, { id: 2 }] })).toEqual({
      $or: [{ id: 1 }, { id: 2 }],
    })
  })

  it('merges all $and branches up when keys do not collide', () => {
    expect(simplifyQuery({ $and: [{ a: 1 }, { b: 2 }] })).toEqual({
      a: 1,
      b: 2,
    })
  })

  it('keeps a multi-branch $and when a key collides (e.g. a split range)', () => {
    expect(
      simplifyQuery({ $and: [{ c: { $gt: 1 } }, { c: { $lt: 9 } }] }),
    ).toEqual({ $and: [{ c: { $gt: 1 } }, { c: { $lt: 9 } }] })
  })

  it('does NOT merge a multi-branch $or up (disjunction)', () => {
    expect(simplifyQuery({ status: 'a', $or: [{ x: 1 }, { y: 2 }] })).toEqual({
      status: 'a',
      $or: [{ x: 1 }, { y: 2 }],
    })
  })

  it('hoists a nested pure $or (multi-branch)', () => {
    expect(
      simplifyQuery({ $or: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }] }),
    ).toEqual({ $or: [{ a: 1 }, { b: 2 }, { c: 3 }] })
  })

  it('simplifies recursively and merges up', () => {
    expect(
      simplifyQuery({ $and: [{ $or: [{ id: 1 }] }, { $and: [{ a: 2 }] }] }),
    ).toEqual({ id: 1, a: 2 })
  })

  it('preserves filters and merges a (deduped) single-branch $and up beside them', () => {
    expect(
      simplifyQuery({
        $limit: 10,
        $sort: { id: 1 },
        $and: [{ id: 1 }, { id: 1 }],
      }),
    ).toEqual({ $limit: 10, $sort: { id: 1 }, id: 1 })
  })

  it('removes an empty branch from $and and merges the rest up', () => {
    expect(simplifyQuery({ $and: [{}, { a: 1 }, { b: 2 }] })).toEqual({
      a: 1,
      b: 2,
    })
  })

  it('drops a $or whose only branch is empty', () => {
    expect(simplifyQuery({ $or: [{}] })).toEqual({})
  })

  it('handles $and and $or present together', () => {
    expect(
      simplifyQuery({ $and: [{ a: 1 }], $or: [{ b: 2 }, { c: 3 }] }),
    ).toEqual({ a: 1, $or: [{ b: 2 }, { c: 3 }] })
  })

  it('simplifies deeply nested structures', () => {
    expect(simplifyQuery({ $and: [{ $and: [{ $or: [{ a: 1 }] }] }] })).toEqual({
      a: 1,
    })
  })

  it('keeps the $and (carrying an $or) when it collides with the root $or', () => {
    const query = {
      $or: [{ a: 1 }, { a: 2 }],
      $and: [{ $or: [{ b: 1 }, { b: 2 }] }],
    }
    expect(simplifyQuery(query)).toEqual({
      $or: [{ a: 1 }, { a: 2 }],
      $and: [{ $or: [{ b: 1 }, { b: 2 }] }],
    })
  })

  it('still simplifies nested levels even when replaceAnd is false', () => {
    expect(
      simplifyQuery(
        { $and: [{ $or: [{ a: 1 }, { a: 1 }] }] },
        { replaceAnd: false },
      ),
    ).toEqual({ $and: [{ a: 1 }] })
  })

  it('does not recurse into $nor (left untouched)', () => {
    const query = { $nor: [{ $or: [{ a: 1 }, { a: 1 }] }] }
    expect(simplifyQuery(query)).toEqual(query)
  })

  it('does not touch non-logical operators like $in', () => {
    expect(simplifyQuery({ a: { $in: [1, 1, 2] }, $and: [{ b: 2 }] })).toEqual({
      a: { $in: [1, 1, 2] },
      b: 2,
    })
  })

  it('is idempotent', () => {
    const query = {
      $and: [
        { a: 1 },
        { $or: [{ b: 2 }, { b: 2 }] },
        { $and: [{ c: 3 }, { d: 4 }] },
      ],
      $or: [{ e: 5 }],
    }
    const once = simplifyQuery(query)
    expect(simplifyQuery(once)).toEqual(once)
  })

  it('does not mutate the input', () => {
    const query = { $and: [{ id: 1 }, { id: 1 }], $or: [{ a: 1 }] }
    const snapshot = structuredClone(query)
    simplifyQuery(query)
    expect(query).toEqual(snapshot)
  })
})
