import { describe, it, expect } from 'vitest'
import { queryHasProperty } from './query-has-property.util.js'

describe('queryHasProperty', () => {
  it('finds a top-level property', () => {
    expect(queryHasProperty({ isTemplate: true }, 'isTemplate')).toBe(true)
  })

  it('returns false when the property is absent', () => {
    expect(queryHasProperty({ age: { $gt: 18 } }, 'isTemplate')).toBe(false)
  })

  it('finds a property that uses an operator', () => {
    expect(queryHasProperty({ isTemplate: { $ne: null } }, 'isTemplate')).toBe(
      true,
    )
  })

  it('finds a property nested in $and', () => {
    expect(
      queryHasProperty({ $and: [{ isTemplate: true }] }, 'isTemplate'),
    ).toBe(true)
  })

  it('finds a property nested in $or', () => {
    expect(
      queryHasProperty({ $or: [{ isTemplate: true }] }, 'isTemplate'),
    ).toBe(true)
  })

  it('finds a property nested in $nor', () => {
    expect(
      queryHasProperty({ $nor: [{ isTemplate: true }] }, 'isTemplate'),
    ).toBe(true)
  })

  it('finds a deeply nested property ($or > $and)', () => {
    const query = { $or: [{ $and: [{ isTemplate: true }] }] }
    expect(queryHasProperty(query, 'isTemplate')).toBe(true)
  })

  it('accepts an array of names and returns true if any is present', () => {
    expect(queryHasProperty({ status: 'x' }, ['isTemplate', 'status'])).toBe(
      true,
    )
  })

  it('accepts an array of names and returns false if none is present', () => {
    expect(queryHasProperty({ age: 1 }, ['isTemplate', 'status'])).toBe(false)
  })

  it('returns false for an empty query', () => {
    expect(queryHasProperty({}, 'isTemplate')).toBe(false)
  })

  it('does not mutate the query', () => {
    const query = { $and: [{ isTemplate: true }], age: { $gt: 1 } }
    const snapshot = structuredClone(query)
    queryHasProperty(query, 'isTemplate')
    expect(query).toEqual(snapshot)
  })
})
