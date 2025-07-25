import type { HookContext } from '@feathersjs/feathers'
import { setData } from './set-data.hook.js'
import { Forbidden } from '@feathersjs/errors'

describe('setData', function () {
  it('sets userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: {},
      } as HookContext

      const result = setData('params.user.id', 'userId')(context) as HookContext

      assert.strictEqual(
        result.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })
})

it('overwrites userId for single item', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: { userId: 2 },
    } as HookContext

    const result = setData('params.user.id', 'userId')(context) as HookContext

    assert.strictEqual(
      result.data.userId,
      1,
      `'${method}': data has 'userId:1'`,
    )
  })
})

it('sets userId for multiple items', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: [{}, {}, {}],
    } as HookContext

    const result = setData('params.user.id', 'userId')(context) as HookContext
    result.data.forEach((item: any) => {
      assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
    })
  })
})

it('overwrites userId for multiple items', function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        user: {
          id: 1,
        },
      },
      data: [{ userId: 2 }, {}, { userId: 'abc' }],
    } as HookContext

    const result = setData('params.user.id', 'userId')(context) as HookContext
    result.data.forEach((item: any) => {
      assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
    })
  })
})

it("does not change createdById if 'params.user.id' is not provided", function () {
  const methods = ['create', 'update', 'patch', 'remove']
  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {},
      data: { userId: 2 },
    } as HookContext

    const result = setData('params.user.id', 'userId')(context) as HookContext

    assert.strictEqual(
      result.data.userId,
      2,
      `'${method}': data has 'userId:2'`,
    )
  })
})

it("throws if 'external' is set and context.user.id is undefined", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        provider: 'socket.io',
      },
      data: {},
    } as HookContext

    expect(() => setData('params.user.id', 'userId')(context)).toThrow(
      Forbidden,
    )
  })
})

it("passes if 'external' and 'allowUndefined: true'", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      provider: 'socket.io',
      params: {},
      data: {},
    } as unknown as HookContext

    assert.doesNotThrow(
      () =>
        setData('params.user.id', 'userId', { allowUndefined: true })(context),
      `'/${method}': passes`,
    )
  })
})

it("passes if 'external' is set and context.user.id is undefined but overwrite: false", function () {
  const methods = ['create', 'update', 'patch', 'remove']

  methods.forEach((method) => {
    const context = {
      method,
      type: 'before',
      params: {
        provider: 'socket.io',
      },
      data: { userId: 1 },
    } as unknown as HookContext

    assert.doesNotThrow(
      () => setData('params.user.id', 'userId', { overwrite: false })(context),
      `'${method}': passes`,
    )
  })
})

describe('overwrite: false', function () {
  it('sets userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: {},
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: false,
      })(context) as HookContext

      assert.strictEqual(
        result.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })

  it('does not overwrite userId for single item', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: false,
      })(context) as HookContext

      assert.strictEqual(
        result.data.userId,
        2,
        `'${method}': data has 'userId:2'`,
      )
    })
  })

  it('sets userId for multiple items', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{}, {}, {}],
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: false,
      })(context) as HookContext

      result.data.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `${method}': data has 'userId:1'`)
      })
    })
  })

  it('overwrites userId for multiple items', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: false,
      })(context) as HookContext

      result.data.forEach((item: any, i: any) => {
        assert.strictEqual(item.userId, i, `${method}': data has 'userId:${i}`)
      })
    })
  })
})

describe('overwrite: predicate', function () {
  it('overwrites userId for multiple items per predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 2 }, {}, { userId: 'abc' }],
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: () => true,
      })(context) as HookContext

      result.data.forEach((item: any) => {
        assert.strictEqual(item.userId, 1, `'${method}': data has 'userId:1'`)
      })
    })
  })

  it('does not overwrite userId for single item by predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: (item: any) => item.userId == null,
      })(context) as HookContext

      assert.strictEqual(
        result.data.userId,
        2,
        `'${method}': data has 'userId:2'`,
      )
    })
  })

  it('predicate based on context', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: { userId: 2 },
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: (item: any, context) => context.type === 'before',
      })(context) as HookContext

      assert.strictEqual(
        result.data.userId,
        1,
        `'${method}': data has 'userId:1'`,
      )
    })
  })

  it('overwrites userId for multiple items by predicate', function () {
    const methods = ['create', 'update', 'patch', 'remove']

    methods.forEach((method) => {
      const context = {
        method,
        type: 'before',
        params: {
          user: {
            id: 1,
          },
        },
        data: [{ userId: 0 }, {}, { userId: 2 }],
      } as unknown as HookContext

      const result = setData('params.user.id', 'userId', {
        overwrite: (item) => item.userId == null,
      })(context) as HookContext

      result.data.forEach((item: any, i: any) => {
        assert.strictEqual(item.userId, i, `${method}': data has 'userId:${i}`)
      })
    })
  })
})
