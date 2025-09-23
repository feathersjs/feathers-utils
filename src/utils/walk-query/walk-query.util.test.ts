import { walkQuery } from './walk-query.util.js'

describe('walkQuery', () => {
  it('simple case', () => {
    const query = {
      a: 1,
    }

    const result = walkQuery(query, ({ value }) => {
      return value * 2
    })

    expect(result).toEqual({ a: 2 })
    expect(query).toEqual({ a: 1 })
  })

  it('simple operator', () => {
    const query = {
      a: { $gt: 1 },
    }

    const result = walkQuery(query, ({ value, operator }) => {
      if (operator === '$gt') {
        return value * 2
      }
      return value
    })

    expect(result).toEqual({ a: { $gt: 2 } })
    expect(query).toEqual({ a: { $gt: 1 } })
  })

  it('multiple operators', () => {
    const query = {
      a: { $gt: 1, $lt: 10 },
    }

    const result = walkQuery(query, ({ value, operator }) => {
      if (operator === '$gt') {
        return value * 2
      }
      if (operator === '$lt') {
        return value - 5
      }
      return value
    })

    expect(result).toEqual({ a: { $gt: 2, $lt: 5 } })
    expect(query).toEqual({ a: { $gt: 1, $lt: 10 } })
  })

  it('return undefined', () => {
    const query = {
      a: 1,
    }

    const result = walkQuery(query, () => undefined)

    expect(result).toEqual({ a: 1 })
    expect(query).toBe(result)
  })

  it('$or operator', () => {
    const query = {
      $or: [{ a: { $gt: 1 } }, { b: 3 }],
    }

    const result = walkQuery(query, ({ property, value, operator }) => {
      if (operator === '$gt') {
        return value * 2
      }
      return value
    })

    expect(result).toEqual({ $or: [{ a: { $gt: 2 } }, { b: 3 }] })
    expect(query).toEqual({ $or: [{ a: { $gt: 1 } }, { b: 3 }] })
  })

  it('$and operator', () => {
    const query = {
      $and: [{ a: { $gt: 1 } }, { b: 3 }],
    }

    const result = walkQuery(query, ({ value, operator }) => {
      if (operator === '$gt') {
        return value * 2
      }
      return value
    })

    expect(result).toEqual({ $and: [{ a: { $gt: 2 } }, { b: 3 }] })
    expect(query).toEqual({ $and: [{ a: { $gt: 1 } }, { b: 3 }] })
  })

  it('nested $or/and', () => {
    const query = {
      $and: [
        { $or: [{ a: { $gt: 1 } }, { b: 3 }] },
        { $or: [{ c: { $lt: 10 } }, { d: 20 }] },
      ],
    }

    const result = walkQuery(query, ({ value, operator }) => {
      if (operator === '$gt') {
        return value * 2
      }
      if (operator === '$lt') {
        return value - 5
      }
      return value
    })

    expect(result).toEqual({
      $and: [
        { $or: [{ a: { $gt: 2 } }, { b: 3 }] },
        { $or: [{ c: { $lt: 5 } }, { d: 20 }] },
      ],
    })
    expect(query).toEqual({
      $and: [
        { $or: [{ a: { $gt: 1 } }, { b: 3 }] },
        { $or: [{ c: { $lt: 10 } }, { d: 20 }] },
      ],
    })
  })

  it('no mutation', () => {
    const query = {
      $and: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }],
      d: { $gt: 4 },
    }

    const result = walkQuery(query, () => undefined)

    expect(result).toEqual({
      $and: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }],
      d: { $gt: 4 },
    })
    expect(query).toBe(result)
  })
})
