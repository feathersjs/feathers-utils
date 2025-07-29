import { defineHooks } from './define-hooks.util.js'

describe('defineHooks', () => {
  it('should return the hooks with type safety', () => {
    const hooks = defineHooks({
      before: {
        find: [() => {}],
        get: [() => {}],
        create: [() => {}],
        update: [() => {}],
        patch: [() => {}],
        remove: [() => {}],
      },
      after: {},
      error: {},
      around: {},
    })

    // Check that the returned hooks match the expected structure
    expect(hooks).toHaveProperty('before.find')
    expect(hooks).toHaveProperty('before.get')
    expect(hooks).toHaveProperty('before.create')
    expect(hooks).toHaveProperty('before.update')
    expect(hooks).toHaveProperty('before.patch')
    expect(hooks).toHaveProperty('before.remove')
  })
})
