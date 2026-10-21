import { describe, it, expect } from 'vitest'
import { queryDefaults } from './query-defaults.util.js'
import { expectNoSideEffects } from '../../testing/index.js'

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

  it('does not mutate the input query', async () => {
    await expectNoSideEffects(
      {
        query: { status: 'x', $or: [{ isTemplate: true }, { a: 1 }] },
        defaults: { isTemplate: false, archived: false },
      },
      ({ query, defaults }) => queryDefaults(query, defaults),
    )
  })

  // sequelize's operators, e.g. `{ [Op.or]: [...] }`
  describe('symbol keys', () => {
    const or = Symbol.for('or')

    it('adds a default with a symbol key', () => {
      const result: any = queryDefaults({ a: 1 }, { [or]: [{ x: 1 }] } as any)

      expect(result.a).toBe(1)
      expect(result[or]).toEqual([{ x: 1 }])
    })

    it('does not add it when the query has the symbol key', () => {
      const result: any = queryDefaults(
        { [or]: [{ y: 1 }] } as any,
        {
          [or]: [{ x: 1 }],
        } as any,
      )

      expect(result[or]).toEqual([{ y: 1 }])
    })
  })
})
