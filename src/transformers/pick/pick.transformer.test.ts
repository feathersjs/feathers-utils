import { pick } from './pick.transformer.js'

const options = { context: {} as any, i: 0 }

describe('transformers/pick', () => {
  it('single field', () => {
    const item = { name: 'John', email: 'john@example.com' }
    const picked = pick('email')(item, options)
    expect(picked).toEqual({ email: 'john@example.com' })
  })

  it('multiple fields', () => {
    const item = { name: 'John', email: 'john@example.com', age: 30 }
    const picked = pick(['email', 'age'])(item, options)
    expect(picked).toEqual({ email: 'john@example.com', age: 30 })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'John' }
    const picked = pick('missingField')(item, options)
    expect(picked).toEqual({})
  })

  it('handles dot notation', () => {
    const item = { user: { name: 'John', email: 'john@example.com' } }
    const picked = pick('user.email')(item, options)
    expect(picked).toEqual({ user: { email: 'john@example.com' } })
  })
})
