import { parseDate } from './parse-date.transformer.js'

describe('transformers/parseDate', () => {
  it('single field', () => {
    const item = { date: '2023-10-01T12:00:00Z' } as any
    parseDate(item, 'date')
    expect(item).toEqual({ date: new Date('2023-10-01T12:00:00Z') })
  })

  it('multiple fields', () => {
    const item = {
      startDate: '2023-10-01T12:00:00Z',
      endDate: '2023-10-02T12:00:00Z',
    } as any
    parseDate(item, ['startDate', 'endDate'])
    expect(item).toEqual({
      startDate: new Date('2023-10-01T12:00:00Z'),
      endDate: new Date('2023-10-02T12:00:00Z'),
    })
  })

  it('ignores null or undefined values', () => {
    const item = { date: null, anotherDate: undefined } as any
    parseDate(item, ['date', 'anotherDate'])
    expect(item).toEqual({ date: null, anotherDate: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { date: '2023-10-01T12:00:00Z' } as any
    parseDate(item, 'missingField')
    expect(item).toEqual({ date: '2023-10-01T12:00:00Z' })
  })

  it('handles dot notation', () => {
    const item = { event: { startTime: '2023-10-01T12:00:00Z' } }
    parseDate(item, 'event.startTime')
    expect(item).toEqual({
      event: { startTime: new Date('2023-10-01T12:00:00Z') },
    })
  })
})
