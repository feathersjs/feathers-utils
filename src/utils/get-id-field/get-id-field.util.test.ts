import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { getIdField } from './get-id-field.util.js'

describe('getIdField', () => {
  it('reads the id field of an adapter service', () => {
    const app = feathers()
    app.use('users', new MemoryService({ id: '_id' }))
    app.use('todos', new MemoryService())

    expect(getIdField(app.service('users'))).toBe('_id')
    expect(getIdField(app.service('todos'))).toBe('id')
  })

  it('falls back to options.id, then to id', () => {
    expect(getIdField({ options: { id: 'uid' } })).toBe('uid')
    expect(getIdField({ id: 'key', options: { id: 'uid' } })).toBe('key')
    expect(getIdField({})).toBe('id')
    expect(getIdField(undefined)).toBe('id')
    expect(getIdField(null)).toBe('id')
  })
})
