import { lowercase } from './lowercase.transformer.js'

describe('transformers/lowercase', () => {
  it('single string', () => {
    const item = { name: 'TEST' }
    lowercase(item, 'name')
    expect(item).toEqual({ name: 'test' })
  })

  it('multiple strings', () => {
    const item = { name: 'TEST', email: 'TEST@EXAMPLE.COM' }
    lowercase(item, ['name', 'email'])
    expect(item).toEqual({ name: 'test', email: 'test@example.com' })
  })

  it('throws error for non-string values', () => {
    const item = { name: 123 } as any
    expect(() => lowercase(item, 'name')).toThrow(
      "Expected string (lowercase 'name')",
    )
  })

  it('ignores null or undefined values', () => {
    const item = { name: null, email: undefined } as any
    lowercase(item, ['name', 'email'])
    expect(item).toEqual({ name: null, email: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'Test' } as Record<string, any>
    lowercase(item, 'missingField')
    expect(item).toEqual({ name: 'Test' })
  })

  it('handles dot.notation', () => {
    const item = { user: { name: 'TEST' } }
    lowercase(item, 'user.name')
    expect(item).toEqual({ user: { name: 'test' } })
  })
})
