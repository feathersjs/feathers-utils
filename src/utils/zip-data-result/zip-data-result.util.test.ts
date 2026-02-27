import { expectTypeOf } from 'vitest'
import type { Application, HookContext } from '@feathersjs/feathers'
import { zipDataResult } from './zip-data-result.util.js'
import type { ZipDataResultItem } from './zip-data-result.util.js'
import type { MemoryService } from '@feathersjs/memory'

const make = (type: any, method: any, data: any, result: any) =>
  ({ type, method, data, result }) as HookContext

describe('zipDataResult (type tests)', () => {
  type Todo = {
    id: number
    title: string
    userId: number
  }

  type App = Application<{
    todos: MemoryService<Todo>
  }>

  type TodoContext = HookContext<App, MemoryService<Todo>>

  it('returns typed ZipDataResultItem array', () => {
    const context = {
      type: 'after',
      method: 'create',
      data: {},
      result: {},
    } as unknown as TodoContext
    const result = zipDataResult(context)

    expectTypeOf(result).toEqualTypeOf<
      ZipDataResultItem<Partial<Todo>, Todo>[]
    >()
  })

  it('works with a plain HookContext', () => {
    const context = {
      type: 'after',
      method: 'create',
      data: {},
      result: {},
    } as unknown as HookContext
    const result = zipDataResult(context)

    expectTypeOf(result).toEqualTypeOf<ZipDataResultItem<any, any>[]>()
  })
})

describe('zipDataResult', () => {
  it('throws for invalid context type', () => {
    expect(() => make('before', 'create', [], [])).not.toThrow()
    expect(() => zipDataResult(make('before', 'create', [], []))).toThrow()
  })

  it('throws for invalid context method', () => {
    expect(() => zipDataResult(make('after', 'find', [], []))).toThrow()
    expect(() => zipDataResult(make('after', 'get', {}, {}))).toThrow()
    expect(() => zipDataResult(make('after', 'remove', {}, {}))).toThrow()
  })

  it('works with after create', () => {
    expect(() =>
      zipDataResult(make('after', 'create', {}, {})),
    ).not.toThrow()
  })

  it('works with after update', () => {
    expect(() =>
      zipDataResult(make('after', 'update', {}, {})),
    ).not.toThrow()
  })

  it('works with after patch', () => {
    expect(() =>
      zipDataResult(make('after', 'patch', {}, {})),
    ).not.toThrow()
  })

  it('works with around type', () => {
    expect(() =>
      zipDataResult(make('around', 'create', {}, {})),
    ).not.toThrow()
  })

  it('zips single data with single result', () => {
    const data = { title: 'hello' }
    const result = { id: 1, title: 'hello' }
    const zipped = zipDataResult(make('after', 'create', data, result))

    expect(zipped).toEqual([{ data, result }])
  })

  it('zips array data with array result', () => {
    const data = [{ title: 'a' }, { title: 'b' }]
    const result = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
    ]
    const zipped = zipDataResult(make('after', 'create', data, result))

    expect(zipped).toEqual([
      { data: { title: 'a' }, result: { id: 1, title: 'a' } },
      { data: { title: 'b' }, result: { id: 2, title: 'b' } },
    ])
  })

  it('repeats single data for each result item', () => {
    const data = { title: 'hello' }
    const result = [
      { id: 1, title: 'hello' },
      { id: 2, title: 'hello' },
    ]
    const zipped = zipDataResult(make('after', 'patch', data, result))

    expect(zipped).toEqual([
      { data, result: { id: 1, title: 'hello' } },
      { data, result: { id: 2, title: 'hello' } },
    ])
  })

  it('handles empty arrays', () => {
    const zipped = zipDataResult(make('after', 'create', [], []))

    expect(zipped).toEqual([])
  })

  it('calls onMismatch when array lengths differ', () => {
    const onMismatch = vi.fn()
    const data = [{ title: 'a' }]
    const result = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
      { id: 3, title: 'c' },
    ]
    const context = make('after', 'create', data, result)

    const zipped = zipDataResult(context, { onMismatch })

    expect(onMismatch).toHaveBeenCalledOnce()
    expect(onMismatch).toHaveBeenCalledWith(context)
    expect(zipped).toEqual([
      { data: { title: 'a' }, result: { id: 1, title: 'a' } },
      { data: undefined, result: { id: 2, title: 'b' } },
      { data: undefined, result: { id: 3, title: 'c' } },
    ])
  })

  it('does not call onMismatch when array lengths match', () => {
    const onMismatch = vi.fn()
    const data = [{ title: 'a' }]
    const result = [{ id: 1, title: 'a' }]

    zipDataResult(make('after', 'create', data, result), { onMismatch })

    expect(onMismatch).not.toHaveBeenCalled()
  })

  it('does not call onMismatch when data is not an array', () => {
    const onMismatch = vi.fn()
    const data = { title: 'a' }
    const result = [{ id: 1, title: 'a' }, { id: 2, title: 'a' }]

    const zipped = zipDataResult(make('after', 'patch', data, result), { onMismatch })

    expect(onMismatch).not.toHaveBeenCalled()
    expect(zipped).toEqual([
      { data, result: { id: 1, title: 'a' } },
      { data, result: { id: 2, title: 'a' } },
    ]);
  })

  it('works without options', () => {
    const data = { title: 'hello' }
    const result = { id: 1, title: 'hello' }
    const zipped = zipDataResult(make('after', 'create', data, result))

    expect(zipped).toHaveLength(1)
  })
})
