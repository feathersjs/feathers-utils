import { pick } from './pick.transformer.js'

describe('transformers/pick', () => {
  it('single field', () => {
    const item = { name: 'John', email: 'john@example.com' }
    const picked = pick(item, 'email')
    expect(picked).toEqual({ email: 'john@example.com' })
  })

  it('multiple fields', () => {
    const item = { name: 'John', email: 'john@example.com', age: 30 }
    const picked = pick(item, ['email', 'age'])
    expect(picked).toEqual({ email: 'john@example.com', age: 30 })
  })

  it('does not throw if field is missing', () => {
    const item = { name: 'John' } as Record<string, any>
    const picked = pick(item, 'missingField')
    expect(picked).toEqual({})
  })

  it('handles dot notation', () => {
    const item = { user: { name: 'John', email: 'john@example.com' } }
    const picked = pick(item, 'user.email')
    expect(picked).toEqual({ user: { email: 'john@example.com' } })
  })
})
