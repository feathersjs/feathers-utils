import { parseDate } from './parse-date.transformer.js'

describe('transformers/parseDate', () => {
  it('single field', () => {
    const item = { date: '2023-10-01T12:00:00Z' }
    parseDate('date')(item)
    expect(item).toEqual({ date: new Date('2023-10-01T12:00:00Z') })
  })

  it('multiple fields', () => {
    const item = {
      startDate: '2023-10-01T12:00:00Z',
      endDate: '2023-10-02T12:00:00Z',
    }
    parseDate(['startDate', 'endDate'])(item)
    expect(item).toEqual({
      startDate: new Date('2023-10-01T12:00:00Z'),
      endDate: new Date('2023-10-02T12:00:00Z'),
    })
  })

  it('ignores null or undefined values', () => {
    const item = { date: null, anotherDate: undefined }
    parseDate(['date', 'anotherDate'])(item)
    expect(item).toEqual({ date: null, anotherDate: undefined })
  })

  it('does not throw if field is missing', () => {
    const item = { date: '2023-10-01T12:00:00Z' }
    parseDate('missingField')(item)
    expect(item).toEqual({ date: '2023-10-01T12:00:00Z' })
  })

  it('handles dot notation', () => {
    const item = { event: { startTime: '2023-10-01T12:00:00Z' } }
    parseDate('event.startTime')(item)
    expect(item).toEqual({
      event: { startTime: new Date('2023-10-01T12:00:00Z') },
    })
  })
})
