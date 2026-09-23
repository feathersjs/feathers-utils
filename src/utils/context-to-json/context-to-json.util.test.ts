import type { HookContext } from '@feathersjs/feathers'
import { contextToJson } from './context-to-json.util.js'
import { expectNoSideEffects } from '../../../test/utils/index.js'

describe('util contextToJson', () => {
  it('returns what toJSON() returns', () => {
    const json = { method: 'find' }
    const context = { toJSON: () => json } as unknown as HookContext

    expect(contextToJson(context)).toBe(json)
  })

  it('returns a context without toJSON() as is', () => {
    const context = { method: 'find' } as HookContext

    expect(contextToJson(context)).toBe(context)
  })

  it('does not mutate params', async () => {
    await expectNoSideEffects({ query: { name: 'Jane' } }, (params) =>
      contextToJson({ type: 'before', method: 'find', params } as HookContext),
    )
  })
})
