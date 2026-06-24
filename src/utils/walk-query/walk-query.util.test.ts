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

  it('stops the traversal when stop() is called', () => {
    const query = { a: 1, b: 2, c: 3 }

    const visited: string[] = []
    walkQuery(query, ({ property, stop }) => {
      visited.push(property)
      if (property === 'b') {
        stop()
      }
    })

    expect(visited).toEqual(['a', 'b'])
  })

  it('stops the traversal inside nested $and/$or', () => {
    const query = {
      $and: [{ a: 1 }, { $or: [{ b: 2 }, { c: 3 }] }],
      d: 4,
    }

    const visited: string[] = []
    walkQuery(query, ({ property, stop }) => {
      visited.push(property)
      if (property === 'b') {
        stop()
      }
    })

    expect(visited).toEqual(['a', 'b'])
  })

  it('applies the replacement of the stopping call, then halts', () => {
    const query = { a: 1, b: 2 }

    const result = walkQuery(query, ({ property, value, stop }) => {
      if (property === 'a') {
        stop()
        return value * 10
      }
      return value
    })

    expect(result).toEqual({ a: 10, b: 2 })
  })
})
