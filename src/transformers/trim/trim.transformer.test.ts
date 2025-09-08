import { trim } from './trim.transformer.js'

const options = { context: {} as any, i: 0 }

describe('transformers/trim', () => {
  it('single string', () => {
    const item = { name: ' TEST ' }
    trim('name')(item, options)
    expect(item).toEqual({ name: 'TEST' })
  })

  it('multiple strings', () => {
    const item = { name: ' TEST ', email: ' TEST@EXAMPLE.COM ' }
    trim(['name', 'email'])(item, options)
    expect(item).toEqual({ name: 'TEST', email: 'TEST@EXAMPLE.COM' })
  })

  it('throws error for non-string values', () => {
    const item = { name: 123 }
    expect(() => trim('name')(item, options)).toThrow(
      "Expected string (trim 'name')",
    )
  })

  it('ignores null or undefined values', () => {
    const item = { name: null, email: undefined }
    trim(['name', 'email'])(item, options)
    expect(item).toEqual({ name: null, email: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'Test' }
    trim('missingField')(item, options)
    expect(item).toEqual({ name: 'Test' })
  })

  it('handles dot.notation', () => {
    const item = { user: { name: ' TEST ' } }
    trim('user.name')(item, options)
    expect(item).toEqual({ user: { name: 'TEST' } })
  })
})
