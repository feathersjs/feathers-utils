import { describe, it, expect } from 'vitest'
import { clone } from './clone.js'

describe('clone', () => {
  it('deep-clones plain objects', () => {
    const input = { a: 1, nested: { b: 2 } }
    const out = clone(input)
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
    expect(out.nested).not.toBe(input.nested)
  })

  it('preserves Date instances (not a JSON string)', () => {
    const date = new Date('2023-10-01T12:00:00Z')
    const out = clone({ date })
    expect(out.date).toBeInstanceOf(Date)
    expect(out.date.getTime()).toBe(date.getTime())
    expect(out.date).not.toBe(date)
  })

  it('preserves undefined values', () => {
    const out = clone({ a: undefined, b: 1 })
    expect('a' in out).toBe(true)
    expect(out.a).toBeUndefined()
  })

  it('handles arrays', () => {
    const input = [{ a: 1 }, { b: 2 }]
    const out = clone(input)
    expect(out).toEqual(input)
    expect(out[0]).not.toBe(input[0])
  })
})
