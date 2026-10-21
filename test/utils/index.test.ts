import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { trackConcurrency } from './index.js'

describe('trackConcurrency', () => {
  it('records the most calls that ran at the same time', async () => {
    const app = feathers<{ todos: MemoryService }>()
    app.use('todos', new MemoryService())
    const tracker = trackConcurrency()
    app.service('todos').hooks({ around: { create: [tracker.hook] } })

    await Promise.all([1, 2, 3].map((n) => app.service('todos').create({ n })))
    expect(tracker.max).toBe(3)
  })
})
