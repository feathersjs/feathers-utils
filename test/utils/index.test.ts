import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, trackConcurrency } from './index.js'

describe('expectNoSideEffects', () => {
  const params = { query: { $or: [{ age: { $gt: 18 } }] } }

  it('returns the output of fn', async () => {
    await expect(
      expectNoSideEffects(params, (params) => params.query.$or.length),
    ).resolves.toBe(1)
  })

  it('catches a write below the top level', async () => {
    await expect(
      expectNoSideEffects(params, (params) => {
        params.query.$or[0].age.$gt = 21
      }),
    ).rejects.toThrow()
  })

  it('catches a write that is undone again', async () => {
    await expect(
      expectNoSideEffects(params, (params) => {
        const [branch] = params.query.$or
        params.query.$or[0] = { age: { $gt: 21 } }
        params.query.$or[0] = branch
      }),
    ).rejects.toThrow(TypeError)
  })

  it('catches runs that disagree', async () => {
    await expect(
      expectNoSideEffects(params, (params) => Object.isFrozen(params)),
    ).rejects.toThrow()
  })
})

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
