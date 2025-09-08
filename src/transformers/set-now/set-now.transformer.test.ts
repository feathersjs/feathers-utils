import { setNow } from './set-now.transformer.js'

const options = { context: {} as any, i: 0 }

describe('transformers/setNow', () => {
  it('sets current date on single field', () => {
    const item = {}
    setNow('createdAt')(item, options)
    expect(item).toEqual({ createdAt: expect.any(Date) })
  })

  it('sets current date on multiple fields', () => {
    const item = {}
    setNow(['createdAt', 'updatedAt'])(item, options)
    expect(item).toEqual({
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })
  })

  it('overwrites existing fields', () => {
    const item = {
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    }
    setNow(['createdAt', 'updatedAt'])(item, options)
    expect(item.createdAt.getFullYear()).toBe(new Date().getFullYear())
    expect(item.updatedAt.getFullYear()).toBe(new Date().getFullYear())
  })
})
