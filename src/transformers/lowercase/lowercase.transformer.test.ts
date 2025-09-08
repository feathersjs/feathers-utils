import { lowercase } from './lowercase.transformer.js'

const options = { context: {} as any, i: 0 }

describe('transformers/lowercase', () => {
  it('single string', () => {
    const item = { name: 'TEST' }
    lowercase('name')(item, options)
    expect(item).toEqual({ name: 'test' })
  })

  it('multiple strings', () => {
    const item = { name: 'TEST', email: 'TEST@EXAMPLE.COM' }
    lowercase(['name', 'email'])(item, options)
    expect(item).toEqual({ name: 'test', email: 'test@example.com' })
  })

  it('throws error for non-string values', () => {
    const item = { name: 123 }
    expect(() => lowercase('name')(item, options)).toThrow(
      "Expected string (lowercase 'name')",
    )
  })

  it('ignores null or undefined values', () => {
    const item = { name: null, email: undefined }
    lowercase(['name', 'email'])(item, options)
    expect(item).toEqual({ name: null, email: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'Test' }
    lowercase('missingField')(item, options)
    expect(item).toEqual({ name: 'Test' })
  })

  it('handles dot.notation', () => {
    const item = { user: { name: 'TEST' } }
    lowercase('user.name')(item, options)
    expect(item).toEqual({ user: { name: 'test' } })
  })
})
