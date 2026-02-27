import { expectTypeOf } from 'vitest'
import type { Application, HookContext } from '@feathersjs/feathers'
import { getDataIsArray } from './get-data-is-array.util.js'
import type { MemoryService } from '@feathersjs/memory'

describe('getDataIsArray (type tests)', () => {
  type Todo = {
    id: number
    title: string
    userId: number
  }

  type App = Application<{
    todos: MemoryService<Todo>
  }>

  type TodoContext = HookContext<App, MemoryService<Todo>>

  it('data is typed as an array of the unwrapped data type', () => {
    const context = {} as TodoContext
    const { data, isArray } = getDataIsArray(context)

    expectTypeOf(data).toEqualTypeOf<Partial<Todo>[]>()
    expectTypeOf(isArray).toEqualTypeOf<boolean>()
  })

  it('works with a plain HookContext', () => {
    const context = {} as HookContext
    const { data } = getDataIsArray(context)

    expectTypeOf(data).toEqualTypeOf<any[]>()
  })
})

describe('getDataIsArray', () => {
  it('falsy data', () => {
    expect(getDataIsArray({ data: null } as any)).toEqual({
      isArray: false,
      data: [],
    })

    expect(getDataIsArray({ data: undefined } as any)).toEqual({
      isArray: false,
      data: [],
    })
  })

  it('array data', () => {
    const data = [1, 2, 3]
    expect(getDataIsArray({ data } as any)).toEqual({
      isArray: true,
      data,
    })
  })

  it('non-array data', () => {
    const data = { a: 1, b: 2 }
    expect(getDataIsArray({ data } as any)).toEqual({
      isArray: false,
      data: [data],
    })
  })
})
