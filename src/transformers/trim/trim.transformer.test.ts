import { trim } from './trim.transformer.js'

describe('transformers/trim', () => {
  it('single string', () => {
    const item = { name: ' TEST ' }
    trim(item, 'name')
    expect(item).toEqual({ name: 'TEST' })
  })

  it('multiple strings', () => {
    const item = { name: ' TEST ', email: ' TEST@EXAMPLE.COM ' }
    trim(item, ['name', 'email'])
    expect(item).toEqual({ name: 'TEST', email: 'TEST@EXAMPLE.COM' })
  })

  it('throws error for non-string values', () => {
    const item = { name: 123 } as any
    expect(() => trim(item, 'name')).toThrow("Expected string (trim 'name')")
  })

  it('ignores null or undefined values', () => {
    const item = { name: null, email: undefined } as any
    trim(item, ['name', 'email'])
    expect(item).toEqual({ name: null, email: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'Test' } as Record<string, any>
    trim(item, 'missingField')
    expect(item).toEqual({ name: 'Test' })
  })

  it('handles dot.notation', () => {
    const item = { user: { name: ' TEST ' } }
    trim(item, 'user.name')
    expect(item).toEqual({ user: { name: 'TEST' } })
  })
})
