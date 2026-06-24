import { describe, it, expect } from 'vitest'
import { queryDefaults } from './query-defaults.util.js'

describe('queryDefaults', () => {
  it('adds a default when the field is absent', () => {
    expect(queryDefaults({ status: 'x' }, { isTemplate: false })).toEqual({
      status: 'x',
      isTemplate: false,
    })
  })

  it('creates the query when given undefined', () => {
    expect(queryDefaults(undefined, { isTemplate: false })).toEqual({
      isTemplate: false,
    })
  })

  it('does not add when the field is present at top level', () => {
    expect(queryDefaults({ isTemplate: true }, { isTemplate: false })).toEqual({
      isTemplate: true,
    })
  })

  it('does not add when the field is referenced nested in $or', () => {
    const query = { $or: [{ isTemplate: true }, { foo: 1 }] }
    expect(queryDefaults(query, { isTemplate: false })).toEqual(query)
  })

  it('adds each default independently (per-field)', () => {
    expect(
      queryDefaults(
        { isTemplate: true },
        { isTemplate: false, archived: false },
      ),
    ).toEqual({ isTemplate: true, archived: false })
  })

  it('returns the same query reference when all defaults are present', () => {
    const query = { isTemplate: true }
    expect(queryDefaults(query, { isTemplate: false })).toBe(query)
  })

  it('does not mutate the input query', () => {
    const query = { status: 'x' }
    const snapshot = structuredClone(query)
    queryDefaults(query, { isTemplate: false })
    expect(query).toEqual(snapshot)
  })
})
