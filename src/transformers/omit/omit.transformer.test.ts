import { omit } from './omit.transformer.js'

describe('transformers/omit', () => {
  it('single field', () => {
    const item = omit({ name: 'John', email: 'john@example.com' }, 'email')
    expect(item).toEqual({ name: 'John' })
  })

  it('multiple fields', () => {
    const item = omit({ name: 'John', email: 'john@example.com', age: 30 }, [
      'email',
      'age',
    ])
    expect(item).toEqual({ name: 'John' })
  })

  it('does not throw if field is missing', () => {
    const item = omit({ name: 'John' } as Record<string, any>, 'missingField')
    expect(item).toEqual({ name: 'John' })
  })

  it('handles dot notation', () => {
    const item = omit(
      { user: { name: 'John', email: 'john@example.com' } },
      'user.email',
    )
    expect(item).toEqual({ user: { name: 'John' } })
  })
})
