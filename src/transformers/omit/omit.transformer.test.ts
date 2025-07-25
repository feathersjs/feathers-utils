import { omit } from './omit.transformer.js'

describe('transformers/omit', () => {
  it('single field', () => {
    const item = omit('email')({ name: 'John', email: 'john@example.com' })
    expect(item).toEqual({ name: 'John' })
  })

  it('multiple fields', () => {
    const item = omit(['email', 'age'])({
      name: 'John',
      email: 'john@example.com',
      age: 30,
    })
    expect(item).toEqual({ name: 'John' })
  })

  it('does not throw if field is missing', () => {
    const item = omit('missingField')({ name: 'John' })
    expect(item).toEqual({ name: 'John' })
  })

  it('handles dot notation', () => {
    const item = omit('user.email')({
      user: { name: 'John', email: 'john@example.com' },
    })

    expect(item).toEqual({ user: { name: 'John' } })
  })
})
