import type { HookContext } from '@feathersjs/feathers'
import { transformQuery } from './transform-query.hook.js'

describe('transformQuery', () => {
  it('should transform the query object', () => {
    const context = {
      params: {
        query: {
          foo: 'bar',
          baz: 'qux',
        },
      },
    } as HookContext

    const transformer = (query: Record<string, any>) => {
      return {
        ...query,
        transformed: true,
      }
    }

    const result = transformQuery(transformer)(context)

    expect((result as any).params.query).toEqual({
      foo: 'bar',
      baz: 'qux',
      transformed: true,
    })
  })
})
