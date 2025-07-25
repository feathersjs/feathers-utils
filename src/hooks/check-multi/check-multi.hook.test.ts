import type { HookContext } from '@feathersjs/feathers'
import { checkMulti } from './check-multi.hook.js'
import { MethodNotAllowed } from '@feathersjs/errors'

describe('checkMulti', function () {
  it("passes if 'allowsMulti' not defined", function () {
    const makeContext = (type: string, method: string) =>
      ({
        service: {},
        type,
        method,
      }) as HookContext
    ;['before', 'after'].forEach((type) => {
      ;['find', 'get', 'create', 'update', 'patch', 'remove'].forEach(
        (method) => {
          const context = makeContext(type, method)

          assert.doesNotThrow(
            () => checkMulti()(context),
            `'${type}:${method}': does not throw`,
          )
        },
      )
    })
  })

  it("passes if 'allowsMulti' returns true", function () {
    const makeContext = (type: string, method: string) => {
      const context = {
        service: {
          allowsMulti: () => true,
        },
        method,
        type,
      } as HookContext
      if (method === 'create') {
        if (type === 'before') {
          context.data = []
        } else {
          context.result = []
        }
      }
      return context as HookContext
    }
    ;['before', 'after'].forEach((type) => {
      ;['find', 'get', 'create', 'update', 'patch', 'remove'].forEach(
        (method) => {
          const context = makeContext(type, method)
          assert.doesNotThrow(
            () => checkMulti()(context),
            `'${type}:${method}': does not throw`,
          )
        },
      )
    })
  })

  it("passes for 'find', 'get' and 'update'", function () {
    const makeContext = (type: string, method: string) =>
      ({
        service: {
          allowsMulti: () => false,
        },
        type,
        method,
      }) as HookContext
    ;['before', 'after'].forEach((type) => {
      ;['find', 'get', 'update'].forEach((method) => {
        const context = makeContext(type, method)
        assert.doesNotThrow(
          () => checkMulti()(context),
          `'${type}:${method}': does not throw`,
        )
      })
    })
  })

  it("passes if 'allowsMulti' returns false and is no multi data", function () {
    const makeContext = (type: string, method: string) => {
      const context = {
        service: {
          allowsMulti: (method: string) => method !== 'find',
        },
        method,
        type,
      } as HookContext
      if (method === 'create') {
        if (type === 'before') {
          context.data = {}
        } else {
          context.result = {}
        }
      }
      if (['patch', 'remove'].includes(method)) {
        context.id = 1
      }
      return context as HookContext
    }
    ;['before', 'after'].forEach((type) => {
      ;['create', 'patch', 'remove'].forEach((method) => {
        const context = makeContext(type, method)
        assert.doesNotThrow(
          () => checkMulti()(context),
          `'${type}:${method}': does not throw`,
        )
      })
    })
  })

  it("throws if 'allowsMulti' returns false and multi data", function () {
    const makeContext = (type: string, method: string) => {
      const context = {
        service: {
          allowsMulti: () => false,
        },
        method,
        type,
        data: [],
      } as HookContext
      if (method === 'create') {
        if (type === 'after') {
          context.result = []
        }
      }
      return context as HookContext
    }

    ;['before', 'after'].forEach((type) => {
      ;['create', 'patch', 'remove'].forEach((method) => {
        const context = makeContext(type, method)
        assert.throws(
          () => checkMulti()(context),
          MethodNotAllowed,
          null,
          `'${type}:${method}': throws`,
        )
      })
    })
  })

  it('can skip hook', function () {
    const makeContext = (type: string, method: string) => {
      const context = {
        service: {
          allowsMulti: () => false,
        },
        method,
        type,
        params: {},
      } as HookContext
      if (method === 'create') {
        if (type === 'before') {
          context.data = {}
        } else {
          context.result = {}
        }
      }
      return context as HookContext
    }
    ;['before', 'after'].forEach((type) => {
      ;['create', 'patch', 'remove'].forEach((method) => {
        const context = makeContext(type, method)
        context.params = {
          skipHooks: ['checkMulti'],
        }
        assert.doesNotThrow(
          () => checkMulti()(context),
          `'${type}:${method}': throws`,
        )
      })
    })
  })
})
