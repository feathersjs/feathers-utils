import { omit } from './omit.transformer.js'

const options = { context: {} as any, i: 0 }

describe('transformers/omit', () => {
  it('single field', () => {
    const item = omit('email')(
      { name: 'John', email: 'john@example.com' },
      options,
    )
    expect(item).toEqual({ name: 'John' })
  })

  it('multiple fields', () => {
    const item = omit(['email', 'age'])(
      {
        name: 'John',
        email: 'john@example.com',
        age: 30,
      },
      options,
    )
    expect(item).toEqual({ name: 'John' })
  })

  it('does not throw if field is missing', () => {
    const item = omit('missingField')({ name: 'John' }, options)
    expect(item).toEqual({ name: 'John' })
  })

  it('handles dot notation', () => {
    const item = omit('user.email')(
      {
        user: { name: 'John', email: 'john@example.com' },
      },
      options,
    )

    expect(item).toEqual({ user: { name: 'John' } })
  })
})
