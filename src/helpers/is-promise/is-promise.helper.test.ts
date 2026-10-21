import { isPromise } from './is-promise.helper.js'
import { expectNoSideEffects } from '../../testing/index.js'

describe('isPromise', () => {
  it('is true for a native promise', () => {
    expect(isPromise(Promise.resolve(1))).toBe(true)
    expect(isPromise((async () => {})())).toBe(true)
  })

  it('is false for a thenable that is not a promise', () => {
    expect(isPromise({ then: () => {} })).toBe(false)
  })

  it('is false for other values', () => {
    expect(isPromise(undefined)).toBe(false)
    expect(isPromise(null)).toBe(false)
    expect(isPromise(1)).toBe(false)
    expect(isPromise({})).toBe(false)
  })

  it('does not mutate the input', async () => {
    const value = await expectNoSideEffects({ a: 1 }, (input) =>
      isPromise(input),
    )
    expect(value).toBe(false)
  })
})
