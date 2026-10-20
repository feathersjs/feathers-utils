import { isEqual } from './is-equal.helper.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

// distinct instances with the same value
const [reA, reAAgain, reAIgnoreCase, reAIgnoreCaseAgain, reB] = [
  /a/,
  /a/,
  /a/i,
  /a/i,
  /b/,
]

const cyclic = (value: Record<string, unknown>) => {
  const obj: any = { ...value }
  obj.self = obj
  obj.list = [obj]
  return obj
}

describe('isEqual', () => {
  it('compares plain objects and arrays by content, in any key order', () => {
    expect(
      isEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }),
    ).toBe(true)
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isEqual({ a: undefined }, {})).toBe(false)
    expect(isEqual([1, 2], [2, 1])).toBe(false)
    expect(isEqual([], {})).toBe(false)
    expect(isEqual(Object.create(null), {})).toBe(false)
  })

  it('does not count a non-enumerable key in `b` as a match', () => {
    const b: any = { b: 2, c: 3 }
    Object.defineProperty(b, 'a', { value: 1, enumerable: false })

    expect(isEqual({ a: 1, b: 2 }, b)).toBe(false)
  })

  it('compares objects with the same keys in a different order', () => {
    expect(
      isEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
    ).toBe(true)
    expect(isEqual({ a: 1, b: 2 }, { b: 2, c: 1 })).toBe(false)
  })

  it('compares primitives, BigInt included', () => {
    expect(isEqual(1n, 1n)).toBe(true)
    expect(isEqual({ id: 1n }, { id: 2n })).toBe(false)
    expect(isEqual(1n, 1)).toBe(false)
    expect(isEqual(NaN, NaN)).toBe(true)
    expect(isEqual('1', 1)).toBe(false)
    expect(isEqual(null, undefined)).toBe(false)
  })

  it('compares symbol keys', () => {
    const gt = Symbol('gt')
    expect(isEqual({ [gt]: 1 }, { [gt]: 1 })).toBe(true)
    expect(isEqual({ [gt]: 1 }, { [gt]: 2 })).toBe(false)
    expect(isEqual({ [gt]: 1 }, { [Symbol('gt')]: 1 })).toBe(false)
  })

  it('compares dates and regular expressions by value', () => {
    expect(isEqual(new Date(0), new Date(0))).toBe(true)
    expect(isEqual(new Date(0), new Date(1))).toBe(false)
    expect(isEqual(new Date(0), new Date(0).toISOString())).toBe(false)
    expect(isEqual(reAIgnoreCase, reAIgnoreCaseAgain)).toBe(true)
    expect(isEqual(reA, reAAgain)).toBe(true)
    expect(isEqual(reA, reB)).toBe(false)
    expect(isEqual(reA, reAIgnoreCase)).toBe(false)
  })

  it('compares ObjectIds by their hex string', () => {
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

    expect(isEqual(new ObjectId('a1'), new ObjectId('a1'))).toBe(true)
    expect(isEqual(new ObjectId('a1'), new ObjectId('b2'))).toBe(false)
    expect(
      isEqual({ id: new ObjectId('a1') }, { id: new ObjectId('a1') }),
    ).toBe(true)
  })

  it('compares functions by reference', () => {
    const fn = () => true
    expect(isEqual({ fn }, { fn })).toBe(true)
    expect(isEqual({ fn: () => true }, { fn: () => true })).toBe(false)
  })

  it('compares class instances, maps and sets by reference', () => {
    class Id {
      #hex: string
      constructor(hex: string) {
        this.#hex = hex
      }
      toString() {
        return this.#hex
      }
    }
    const id = new Id('a')
    expect(isEqual({ id }, { id })).toBe(true)
    // look the same, but aren't
    expect(isEqual(new Id('a'), new Id('b'))).toBe(false)
    expect(isEqual(new Map(), new Map())).toBe(false)
    expect(isEqual(new Set(), new Set())).toBe(false)
  })

  it('handles self-references', () => {
    const a = cyclic({ n: 1 })
    expect(isEqual(a, a)).toBe(true)
    expect(isEqual(a, cyclic({ n: 1 }))).toBe(true)
    expect(isEqual(a, cyclic({ n: 2 }))).toBe(false)
    expect(isEqual({ a }, { a: cyclic({ n: 2 }) })).toBe(false)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects(
      { a: { b: [1, { c: new Date(0) }] }, b: { b: [1, { c: new Date(0) }] } },
      (input) => isEqual(input.a, input.b),
    )
    expect(value).toBe(true)
  })
})
