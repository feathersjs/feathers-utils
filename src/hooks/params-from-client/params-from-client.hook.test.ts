import { vi } from 'vitest'
import type { HookContext } from '@feathersjs/feathers'
import { paramsFromClient } from './params-from-client.hook.js'

describe('paramsFromClient', () => {
  it('should move params to query._$client', () => {
    expect(
      paramsFromClient(['a', 'b'])({
        params: {
          query: {
            _$client: {
              a: 1,
              b: 2,
            },
            c: 3,
          },
        },
      } as HookContext),
    ).toEqual({
      params: {
        a: 1,
        b: 2,
        query: {
          c: 3,
        },
      },
    })
  })

  it('should move params to query._$client and leave remaining', () => {
    expect(
      paramsFromClient('a')({
        params: {
          query: {
            _$client: {
              a: 1,
              b: 2,
            },
            c: 3,
          },
        },
      } as HookContext),
    ).toEqual({
      params: {
        a: 1,
        query: {
          _$client: {
            b: 2,
          },
          c: 3,
        },
      },
    })
  })

  describe('around hooks', () => {
    it('calls next() when _$client key is missing', async () => {
      const context = {
        params: { query: { c: 3 } },
      } as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() when _$client is not an object', async () => {
      const context = {
        params: { query: { _$client: 'not-an-object' } },
      } as unknown as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() after extracting whitelisted params', async () => {
      const context = {
        params: {
          query: {
            _$client: { a: 1 },
            c: 3,
          },
        },
      } as HookContext
      const next = vi.fn()

      await paramsFromClient(['a'])(context, next)

      expect(next).toHaveBeenCalledOnce()
      expect(context.params).toEqual({
        a: 1,
        query: { c: 3 },
      })
    })
  })
})
