import type { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { iff } from '../../hooks/iff/iff.hook.js'
import { isSelected } from './is-selected.predicate.js'

const make = ($select?: unknown, service: object = {}) =>
  ({
    params: $select === undefined ? {} : { query: { $select } },
    service,
  }) as unknown as HookContext

describe('isSelected', () => {
  it('is true without a $select', () => {
    expect(isSelected(['name', 'email'])(make())).toBe(true)
    expect(isSelected('name')({ params: {} } as HookContext)).toBe(true)
  })

  it('is true when the $select has all the fields', () => {
    expect(isSelected(['name', 'email'])(make(['email', 'name']))).toBe(true)
    expect(isSelected(['name', 'email'])(make(['name']))).toBe(false)
    expect(isSelected('name')(make([]))).toBe(false)
  })

  it('counts a nested path as selected along with its field', () => {
    expect(isSelected('address.city')(make(['address']))).toBe(true)
    expect(isSelected('address')(make(['address.city']))).toBe(false)
  })

  it('always counts the id field of the service as selected', () => {
    expect(isSelected(['id', 'userId'])(make(['userId']))).toBe(true)
    expect(isSelected('id')(make([]))).toBe(true)
    expect(isSelected('_id')(make([], { id: '_id' }))).toBe(true)
    expect(isSelected('id')(make([], { id: '_id' }))).toBe(false)
  })

  it('selects nothing for a find with $limit: 0, which only counts', () => {
    const find = (query: object) =>
      ({ method: 'find', params: { query }, service: {} }) as HookContext

    expect(isSelected('id')(find({ $limit: 0 }))).toBe(false)
    expect(isSelected('id')(find({ $limit: '0' }))).toBe(false)
    expect(isSelected('id')(find({ $limit: 1 }))).toBe(true)

    // other methods return their items anyway
    expect(
      isSelected('id')({
        method: 'create',
        params: { query: { $limit: 0 } },
        service: {},
      } as unknown as HookContext),
    ).toBe(true)
  })

  it('reads a $select that is not an array as a single field', () => {
    expect(isSelected('name')(make('name'))).toBe(true)
  })

  it('skips a hook for a result without the fields', async () => {
    const app = feathers()
    app.use('posts', new MemoryService({ startId: 1 }))
    const posts = app.service('posts')
    await posts.create({ title: 'a', userId: 1 })

    const populate = vi.fn()
    posts.hooks({ after: { find: [iff(isSelected('userId'), populate)] } })

    await posts.find({ query: { $select: ['title'] } })
    expect(populate).not.toHaveBeenCalled()

    await posts.find({ query: { $select: ['title', 'userId'] } })
    await posts.find()
    expect(populate).toHaveBeenCalledTimes(2)
  })
})
