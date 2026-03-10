import { expect } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { omit } from './omit/omit.js'
import { trim } from './trim/trim.js'
import { lowercase } from './lowercase/lowercase.js'
import { defaults } from './defaults/defaults.js'
import { setNow } from './set-now/set-now.js'

const makeOptions = (value: any, provider?: string) => ({
  value,
  data: {} as any,
  context: { params: { provider } } as unknown as HookContext,
  properties: { path: [], stack: [] },
  i: 0,
})

describe('omit', () => {
  it('returns undefined without condition', () => {
    expect(omit()(makeOptions('hello'))).toBeUndefined()
  })

  it('returns undefined when condition is true', () => {
    const condition = () => true
    expect(omit(condition)(makeOptions('hello'))).toBeUndefined()
  })

  it('returns value when condition is false', () => {
    const condition = () => false
    expect(omit(condition)(makeOptions('hello'))).toBe('hello')
  })

  it('works with isProvider-style condition', () => {
    const isExternal = ({ context }: { context: HookContext }) =>
      !!context.params.provider
    expect(omit(isExternal)(makeOptions('secret', 'rest'))).toBeUndefined()
    expect(omit(isExternal)(makeOptions('secret'))).toBe('secret')
  })
})

describe('trim', () => {
  it('trims string values', () => {
    expect(trim()(makeOptions('  hello  '))).toBe('hello')
  })

  it('returns non-string values unchanged', () => {
    expect(trim()(makeOptions(42))).toBe(42)
    expect(trim()(makeOptions(undefined))).toBeUndefined()
  })

  it('skips when condition is false', () => {
    const condition = () => false
    expect(trim(condition)(makeOptions('  hello  '))).toBe('  hello  ')
  })
})

describe('lowercase', () => {
  it('lowercases string values', () => {
    expect(lowercase()(makeOptions('HELLO'))).toBe('hello')
  })

  it('returns non-string values unchanged', () => {
    expect(lowercase()(makeOptions(42))).toBe(42)
  })

  it('skips when condition is false', () => {
    const condition = () => false
    expect(lowercase(condition)(makeOptions('HELLO'))).toBe('HELLO')
  })
})

describe('defaults', () => {
  it('uses default when value is undefined', () => {
    expect(defaults('fallback')(makeOptions(undefined))).toBe('fallback')
  })

  it('uses default when value is null', () => {
    expect(defaults('fallback')(makeOptions(null))).toBe('fallback')
  })

  it('keeps existing value', () => {
    expect(defaults('fallback')(makeOptions('existing'))).toBe('existing')
  })

  it('accepts a function as default', () => {
    const fn = (ctx: HookContext) => ctx.params.provider || 'server'
    expect(defaults(fn)(makeOptions(undefined, 'rest'))).toBe('rest')
    expect(defaults(fn)(makeOptions(undefined))).toBe('server')
  })

  it('skips when condition is false', () => {
    const condition = () => false
    expect(
      defaults('fallback', condition)(makeOptions(undefined)),
    ).toBeUndefined()
  })
})

describe('setNow', () => {
  it('returns current timestamp', () => {
    const before = Date.now()
    const result = setNow()(makeOptions(undefined))
    const after = Date.now()
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(after)
  })

  it('overrides existing value', () => {
    const result = setNow()(makeOptions(12345))
    expect(result).not.toBe(12345)
    expect(typeof result).toBe('number')
  })

  it('skips when condition is false', () => {
    const condition = () => false
    expect(setNow(condition)(makeOptions('original'))).toBe('original')
  })
})
