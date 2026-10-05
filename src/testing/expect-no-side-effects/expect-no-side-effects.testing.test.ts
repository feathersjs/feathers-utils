import { expectNoSideEffects } from './expect-no-side-effects.testing.js'

describe('expectNoSideEffects', () => {
  const params = { query: { $or: [{ age: { $gt: 18 } }] } }

  it('returns the output of fn', async () => {
    await expect(
      expectNoSideEffects(params, (params) => params.query.$or.length),
    ).resolves.toBe(1)
  })

  it('catches a write below the top level, with a diff', async () => {
    const error = await expectNoSideEffects(params, (params) => {
      params.query.$or[0].age.$gt = 21
    }).catch((error) => error)

    expect(error).toMatchObject({
      name: 'AssertionError',
      message: 'expectNoSideEffects: fn wrote into its input',
      actual: { query: { $or: [{ age: { $gt: 21 } }] } },
      expected: params,
      showDiff: true,
    })
  })

  it('catches a write that is undone again', async () => {
    const error = await expectNoSideEffects(params, (params) => {
      const [branch] = params.query.$or
      params.query.$or[0] = { age: { $gt: 21 } }
      params.query.$or[0] = branch
    }).catch((error) => error)

    expect(error.message).toMatch(/failed on a frozen copy of its input/)
    expect(error.cause).toBeInstanceOf(TypeError)
  })

  it('catches runs that disagree', async () => {
    await expect(
      expectNoSideEffects(params, (params) => Object.isFrozen(params)),
    ).rejects.toMatchObject({ actual: true, expected: false })
  })

  it('catches a write into a class instance', async () => {
    class Id {
      constructor(public hex: string) {}
    }

    await expect(
      expectNoSideEffects({ query: { id: new Id('a') } }, (params) => {
        params.query.id.hex = 'b'
      }),
    ).rejects.toThrow('fn wrote into its input')
  })

  it('catches a write into a map, which freezing does not stop', async () => {
    await expect(
      expectNoSideEffects({ cache: new Map([['a', 1]]) }, (params) => {
        params.cache.set('a', 2)
      }),
    ).rejects.toThrow('fn wrote into its input')
  })

  it('passes errors of fn through', async () => {
    const error = new Error('boom')

    await expect(
      expectNoSideEffects(params, () => {
        throw error
      }),
    ).rejects.toBe(error)
  })

  it('handles self-referencing input', async () => {
    const params: any = { query: { $limit: 1 } }
    params.self = params

    await expect(
      expectNoSideEffects(params, (params) => params.query.$limit),
    ).resolves.toBe(1)
  })
})
