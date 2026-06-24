import { describe, it, expect } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { setQueryDefaults } from './set-query-defaults.hook.js'

const ctx = (query?: any): HookContext =>
  ({ type: 'before', method: 'find', params: { query } }) as any

describe('setQueryDefaults', () => {
  it('adds the default when the field is absent', () => {
    const context = ctx({ status: 'active' })
    setQueryDefaults({ isTemplate: false })(context)
    expect(context.params.query).toEqual({
      status: 'active',
      isTemplate: false,
    })
  })

  it('adds the default when there is no query at all', () => {
    const context = ctx(undefined)
    setQueryDefaults({ isTemplate: false })(context)
    expect(context.params.query).toEqual({ isTemplate: false })
  })

  it('does not override when the field is already set', () => {
    const context = ctx({ isTemplate: true })
    setQueryDefaults({ isTemplate: false })(context)
    expect(context.params.query).toEqual({ isTemplate: true })
  })

  it('does not override when the field is referenced nested in $or', () => {
    const context = ctx({ $or: [{ isTemplate: true }, { foo: 1 }] })
    setQueryDefaults({ isTemplate: false })(context)
    expect(context.params.query).toEqual({
      $or: [{ isTemplate: true }, { foo: 1 }],
    })
  })

  it('applies multiple defaults independently (per-field)', () => {
    const context = ctx({ a: 1 })
    setQueryDefaults({ isTemplate: false, archived: false })(context)
    expect(context.params.query).toEqual({
      a: 1,
      isTemplate: false,
      archived: false,
    })
  })

  it('calls next when used as an around hook', async () => {
    const context = ctx({})
    let called = false
    const next = async () => {
      called = true
    }
    await setQueryDefaults({ isTemplate: false })(context, next)
    expect(called).toBe(true)
    expect(context.params.query).toEqual({ isTemplate: false })
  })
})
