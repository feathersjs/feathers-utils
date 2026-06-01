import { describe, it, expect } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { mutateData } from './mutate-data.util.js'

const ctx = (data: any): HookContext =>
  ({ type: 'before', method: 'create', data }) as any

describe('mutateData', () => {
  it('returns context unchanged when there is no data', () => {
    const context = ctx(undefined)
    expect(mutateData(context, () => ({}))).toBe(context)
  })

  it('returns context unchanged for an empty array', () => {
    const context = ctx([])
    const out = mutateData(context, () => ({ x: 1 }))
    expect(out).toBe(context)
    expect(context.data).toEqual([])
  })

  it('mutates a single item in place (sync)', () => {
    const context = ctx({ name: ' a ' })
    mutateData(context, (item) => {
      item.name = item.name.trim()
    })
    expect(context.data).toEqual({ name: 'a' })
  })

  it('replaces a single item when the transformer returns a new object', () => {
    const context = ctx({ name: 'a' })
    mutateData(context, () => ({ name: 'b' }))
    expect(context.data).toEqual({ name: 'b' })
  })

  it('keeps the item when the transformer returns undefined', () => {
    const context = ctx({ name: 'a' })
    mutateData(context, () => undefined)
    expect(context.data).toEqual({ name: 'a' })
  })

  it('awaits an async transformer for a single item', async () => {
    const context = ctx({ name: 'a' })
    await mutateData(context, async () => ({ name: 'b' }))
    expect(context.data).toEqual({ name: 'b' })
  })

  it('mutates each item of an array', () => {
    const context = ctx([{ n: 1 }, { n: 2 }])
    mutateData(context, (item) => {
      item.n = item.n * 10
    })
    expect(context.data).toEqual([{ n: 10 }, { n: 20 }])
  })

  it('awaits async transformers for arrays', async () => {
    const context = ctx([{ n: 1 }, { n: 2 }])
    await mutateData(context, async (item) => ({ n: item.n + 1 }))
    expect(context.data).toEqual([{ n: 2 }, { n: 3 }])
  })

  it('preserves the array shape', () => {
    const context = ctx([{ n: 1 }])
    mutateData(context, (item) => item)
    expect(Array.isArray(context.data)).toBe(true)
  })
})
