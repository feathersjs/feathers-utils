import { expect } from 'vitest'
import { mutateResult } from './mutate-result.util.js'

describe('mutateResult', () => {
  it("mutates context.result on paginated 'find'", async () => {
    const context = {
      method: 'find',
      result: { total: 2, data: [{ id: 1 }, { id: 2 }] },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({
      total: 2,
      data: [{ id: 2 }, { id: 3 }],
    })
  })

  it("mutates context.result on array 'find'", async () => {
    const context = {
      method: 'find',
      result: [{ id: 1 }, { id: 2 }],
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual([{ id: 2 }, { id: 3 }])
  })

  it("mutates context.result on 'get'", async () => {
    const context = {
      method: 'find',
      id: 1,
      result: { id: 1 },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({ id: 2 })
  })

  it("mutates context.result on 'create'", async () => {
    const context = {
      method: 'create',
      result: { id: 1 },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({ id: 2 })
  })

  it("mutates context.result on multi:'create'", async () => {
    const context = {
      method: 'create',
      result: [{ id: 1 }, { id: 2 }],
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual([{ id: 2 }, { id: 3 }])
  })

  it('mutates context.result on update', async () => {
    const context = {
      method: 'update',
      id: 1,
      result: { id: 1 },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({ id: 2 })
  })

  it('mutates context.result on patch', async () => {
    const context = {
      method: 'patch',
      id: 1,
      result: { id: 1 },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({ id: 2 })
  })

  it('mutates context.result on multi patch', async () => {
    const context = {
      method: 'patch',
      id: null,
      result: [{ id: 1 }, { id: 2 }],
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual([{ id: 2 }, { id: 3 }])
  })

  it('mutates context.result on remove', async () => {
    const context = {
      method: 'remove',
      id: 1,
      result: { id: 1 },
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual({ id: 2 })
  })

  it('mutates context.result on multi remove', async () => {
    const context = {
      method: 'remove',
      id: null,
      result: [{ id: 1 }, { id: 2 }],
    }

    await mutateResult(context as any, (item) => ({ id: item.id + 1 }))

    expect(context.result).toStrictEqual([{ id: 2 }, { id: 3 }])
  })

  it("mutates context.dispatch on 'get'", async () => {
    const context = {
      method: 'find',
      id: 1,
      result: { result: true },
      dispatch: { dispatch: true },
    }

    await mutateResult(context as any, (item) => ({ ...item, test: true }), {
      dispatch: true,
    })

    expect(context.result).toStrictEqual({ result: true })
    expect(context.dispatch).toStrictEqual({ dispatch: true, test: true })
  })

  it("mutates both context.result & context.dispatch on 'get'", async () => {
    const context = {
      method: 'find',
      id: 1,
      result: { result: true },
      dispatch: { dispatch: true },
    }

    await mutateResult(context as any, (item) => ({ ...item, test: true }), {
      dispatch: 'both',
    })

    expect(context.result).toStrictEqual({ result: true, test: true })
    expect(context.dispatch).toStrictEqual({ dispatch: true, test: true })
  })

  it("mutates context.dispatch even though it was not there before on 'get'", async () => {
    const context = {
      method: 'find',
      id: 1,
      result: { result: true },
    } as any

    await mutateResult(
      context as any,
      (item) => {
        item.test = true
        return item
      },
      { dispatch: true },
    )

    expect(context.result).toStrictEqual({ result: true })
    expect(context.dispatch).toStrictEqual({ result: true, test: true })
  })
})
