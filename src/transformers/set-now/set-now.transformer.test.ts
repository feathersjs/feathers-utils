import { setNow } from './set-now.transformer.js'

describe('transformers/setNow', () => {
  it('sets current date on single field', () => {
    const item = {} as Record<string, any>
    setNow(item, 'createdAt')
    expect(item).toEqual({ createdAt: expect.any(Date) })
  })

  it('sets current date on multiple fields', () => {
    const item = {} as Record<string, any>
    setNow(item, ['createdAt', 'updatedAt'])
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
    setNow(item, ['createdAt', 'updatedAt'])
    expect(item.createdAt.getFullYear()).toBe(new Date().getFullYear())
    expect(item.updatedAt.getFullYear()).toBe(new Date().getFullYear())
  })
})
