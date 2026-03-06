import { defaults } from './defaults.transformer.js'

describe('transformers/defaults', () => {
  it('sets a static default when field is undefined', () => {
    const item: Record<string, any> = { name: 'John' }
    defaults(item, { role: 'user' })
    expect(item).toEqual({ name: 'John', role: 'user' })
  })

  it('does not overwrite existing values', () => {
    const item = { name: 'John', role: 'admin' }
    defaults(item, { role: 'user' })
    expect(item).toEqual({ name: 'John', role: 'admin' })
  })

  it('does not overwrite null', () => {
    const item = { name: 'John', role: null } as any
    defaults(item, { role: 'user' })
    expect(item).toEqual({ name: 'John', role: null })
  })

  it('does not overwrite falsy values', () => {
    const item = { name: 'John', active: false, count: 0, bio: '' }
    defaults(item, { active: true, count: 10, bio: 'default' })
    expect(item).toEqual({ name: 'John', active: false, count: 0, bio: '' })
  })

  it('sets a function default when field is undefined', () => {
    const now = new Date('2024-01-01')
    const item: Record<string, any> = { name: 'John' }
    defaults(item, { createdAt: () => now })
    expect(item).toEqual({ name: 'John', createdAt: now })
  })

  it('supports multiple defaults', () => {
    const item: Record<string, any> = { name: 'John' }
    defaults(item, { role: 'user', active: true })
    expect(item).toEqual({ name: 'John', role: 'user', active: true })
  })

  it('supports dot notation', () => {
    const item = { user: { name: 'John' } }
    defaults(item, { 'user.role': 'member' })
    expect(item).toEqual({ user: { name: 'John', role: 'member' } })
  })

  it('does not overwrite existing nested values via dot notation', () => {
    const item = { user: { name: 'John', role: 'admin' } }
    defaults(item, { 'user.role': 'member' })
    expect(item).toEqual({ user: { name: 'John', role: 'admin' } })
  })

  it('creates nested path when parent exists', () => {
    const item: Record<string, any> = { settings: {} }
    defaults(item, { 'settings.theme': 'dark' })
    expect(item).toEqual({ settings: { theme: 'dark' } })
  })
})
