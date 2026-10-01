import { expectTypeOf } from 'vitest'
import type { Application, HookContext } from '@feathersjs/feathers'
import { zipDataResult } from './zip-data-result.util.js'
import type { ZipDataResultItem } from './zip-data-result.util.js'
import type { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects } from '../../../test/utils/index.js'

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
    expect(() => zipDataResult(make('after', 'create', {}, {}))).not.toThrow()
  })

  it('works with after update', () => {
    expect(() => zipDataResult(make('after', 'update', {}, {}))).not.toThrow()
  })

  it('works with after patch', () => {
    expect(() => zipDataResult(make('after', 'patch', {}, {}))).not.toThrow()
  })

  it('works with around type', () => {
    expect(() => zipDataResult(make('around', 'create', {}, {}))).not.toThrow()
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
    const result = [
      { id: 1, title: 'a' },
      { id: 2, title: 'a' },
    ]

    const zipped = zipDataResult(make('after', 'patch', data, result), {
      onMismatch,
    })

    expect(onMismatch).not.toHaveBeenCalled()
    expect(zipped).toEqual([
      { data, result: { id: 1, title: 'a' } },
      { data, result: { id: 2, title: 'a' } },
    ])
  })

  it('works without options', () => {
    const data = { title: 'hello' }
    const result = { id: 1, title: 'hello' }
    const zipped = zipDataResult(make('after', 'create', data, result))

    expect(zipped).toHaveLength(1)
  })

  it('does not mutate params', async () => {
    await expectNoSideEffects({ query: { name: 'Jane' } }, (params) =>
      zipDataResult({
        type: 'after',
        method: 'create',
        params,
        data: [{ a: 1 }],
        result: [{ id: 1, a: 1 }],
      } as HookContext),
    )
  })
})

describe("zipDataResult, by: 'id'", () => {
  const zip = (data: any, result: any, service?: any) =>
    zipDataResult(
      { ...make('after', 'create', data, result), service } as HookContext,
      { by: 'id' },
    )

  it('pairs by id, whatever order the result has', () => {
    const data = [
      { id: 2, title: 'b' },
      { id: 1, title: 'a' },
    ]
    const result = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
    ]

    expect(zip(data, result)).toStrictEqual([
      { data: data[0], result: result[1] },
      { data: data[1], result: result[0] },
    ])
  })

  it('pairs data items without an id by their position', () => {
    const data = [{ title: 'a' }, { title: 'b' }]
    const result = [
      { id: 1, title: 'a' },
      { id: 2, title: 'b' },
    ]

    expect(zip(data, result)).toStrictEqual([
      { data: data[0], result: result[0] },
      { data: data[1], result: result[1] },
    ])
  })

  it("doesn't give a data item without an id a result taken by id", () => {
    const data = [{ id: 5, title: 'a' }, { title: 'b' }]
    const result = [
      { id: 1, title: 'b' },
      { id: 5, title: 'a' },
    ]

    expect(zip(data, result)).toStrictEqual([
      { data: data[0], result: result[1] },
      // its position is taken by the id of the first data item
      { data: data[1], result: undefined },
      { data: undefined, result: result[0] },
    ])
  })

  it('has no result for an id that is not in the result', () => {
    const data = [{ id: 3, title: 'c' }]
    const result = [{ id: 1, title: 'a' }]

    expect(zip(data, result)).toStrictEqual([
      { data: data[0], result: undefined },
      { data: undefined, result: result[0] },
    ])
  })

  it('gives a result to only one of two data items with the same id', () => {
    const data = [
      { id: 1, title: 'a' },
      { id: 1, title: 'b' },
    ]
    const result = [{ id: 1, title: 'a' }]

    expect(zip(data, result)).toStrictEqual([
      { data: data[0], result: result[0] },
      { data: data[1], result: undefined },
    ])
  })

  it('compares ids as strings', () => {
    class ObjectId {
      #hex: string
      constructor(hex: string) {
        this.#hex = hex
      }
      toString() {
        return this.#hex
      }
    }
    const data = [{ id: new ObjectId('b') }, { id: new ObjectId('a') }]
    const result = [{ id: new ObjectId('a') }, { id: new ObjectId('b') }]

    expect(zip(data, result).map(({ result }) => String(result?.id))).toEqual([
      'b',
      'a',
    ])
  })

  it('uses the id field of the service', () => {
    const data = [{ _id: 2 }, { _id: 1 }]
    const result = [{ _id: 1 }, { _id: 2 }]

    expect(zip(data, result, { id: '_id' })).toStrictEqual([
      { data: data[0], result: result[1] },
      { data: data[1], result: result[0] },
    ])
  })

  it('repeats single data for each result item', () => {
    const data = { title: 'hello' }
    const result = [{ id: 1 }, { id: 2 }]

    expect(zip(data, result)).toStrictEqual([
      { data, result: result[0] },
      { data, result: result[1] },
    ])
  })

  it('calls onMismatch when array lengths differ', () => {
    const onMismatch = vi.fn()
    zipDataResult(
      make('after', 'create', [{ id: 1 }], [{ id: 1 }, { id: 2 }]),
      {
        by: 'id',
        onMismatch,
      },
    )

    expect(onMismatch).toHaveBeenCalledTimes(1)
  })
})
