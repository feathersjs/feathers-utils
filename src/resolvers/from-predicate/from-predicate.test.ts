import { expect } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { fromPredicate } from './from-predicate.js'
import { isProvider } from '../../predicates/is-provider/is-provider.predicate.js'
import { omit } from '../helpers/omit/omit.js'

const makeOptions = (value: any, provider?: string) => ({
  value,
  data: {} as any,
  context: { params: { provider } } as unknown as HookContext,
  properties: { path: [], stack: [] },
  i: 0,
})

describe('fromPredicate', () => {
  it('adapts isProvider to a resolver condition', () => {
    const condition = fromPredicate(isProvider('external'))
    expect(condition(makeOptions('test', 'rest'))).toBe(true)
    expect(condition(makeOptions('test'))).toBe(false)
  })

  it('works with omit helper', () => {
    const resolver = omit(fromPredicate(isProvider('external')))
    expect(resolver(makeOptions('secret', 'rest'))).toBeUndefined()
    expect(resolver(makeOptions('secret'))).toBe('secret')
  })

  it('adapts a custom sync predicate', () => {
    const isCreate = (ctx: HookContext) => ctx.method === 'create'
    const condition = fromPredicate(isCreate)
    expect(
      condition({
        ...makeOptions('test'),
        context: { method: 'create', params: {} } as unknown as HookContext,
      }),
    ).toBe(true)
    expect(
      condition({
        ...makeOptions('test'),
        context: { method: 'find', params: {} } as unknown as HookContext,
      }),
    ).toBe(false)
  })

  it('throws for async predicates', () => {
    const asyncPredicate = async () => true
    const condition = fromPredicate(asyncPredicate)
    expect(() => condition(makeOptions('test'))).toThrow(
      'fromPredicate does not support async predicates',
    )
  })
})
