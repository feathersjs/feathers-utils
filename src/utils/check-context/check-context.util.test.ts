import { expect } from 'vitest'

import { checkContext } from './check-context.util.js'
import type { HookContext } from '@feathersjs/feathers'

const make = (type: any, method: any) => ({ type, method }) as HookContext

describe('util checkContext', () => {
  it('handles "any" type and method', () => {
    expect(() => checkContext(make('before', 'create'))).not.toThrow()
  })

  it('handles expected type', () => {
    expect(() => checkContext(make('before', 'create'), 'before')).not.toThrow()
  })

  it('handles unexpected type', () => {
    expect(() => checkContext(make('after', 'create'), 'before')).toThrow()
  })

  it('handles undefined type', () => {
    expect(() =>
      checkContext(make('after', 'create'), undefined, 'create'),
    ).not.toThrow()
  })

  it('handles null type', () => {
    expect(() =>
      checkContext(make('after', 'create'), null, 'create'),
    ).not.toThrow()
  })

  it('handles expected type as array', () => {
    expect(() =>
      checkContext(make('before', 'create'), ['before', 'after']),
    ).not.toThrow()
  })

  it('handles unexpected type as array', () => {
    expect(() =>
      checkContext(make('error', 'create'), ['before', 'after']),
    ).toThrow()
  })

  it('handles expected method as string', () => {
    expect(() =>
      checkContext(make('before', 'create'), null, 'create'),
    ).not.toThrow()
  })

  it('handles unexpected method as string', () => {
    expect(() =>
      checkContext(make('before', 'patch'), null, 'create'),
    ).toThrow()
  })

  it('handles expected method as array', () => {
    expect(() =>
      checkContext(make('before', 'create'), null, [
        'create',
        'update',
        'remove',
      ]),
    ).not.toThrow()
  })

  it('handles unexpected method as array', () => {
    expect(() =>
      checkContext(make('before', 'patch'), null, [
        'create',
        'update',
        'remove',
      ]),
    ).toThrow()
  })

  it('handles undefined method', () => {
    expect(() =>
      checkContext(make('before', 'patch'), null, undefined),
    ).not.toThrow()
  })

  it('handles null method', () => {
    expect(() =>
      checkContext(make('before', 'patch'), null, null),
    ).not.toThrow()
  })

  it('handles expected type and method as array', () => {
    expect(() =>
      checkContext(
        make('before', 'create'),
        ['before', 'after'],
        ['create', 'update', 'remove'],
      ),
    ).not.toThrow()
  })

  it('allows custom methods', () => {
    expect(() =>
      checkContext(make('before', 'custom'), 'before', 'create'),
    ).toThrow()
    expect(() =>
      checkContext(make('before', 'custom'), 'before', ['create', 'custom']),
    ).not.toThrow()
  })

  describe('options object overload', () => {
    it('handles options with type and method', () => {
      expect(() =>
        checkContext(make('before', 'create'), {
          type: 'before',
          method: 'create',
        }),
      ).not.toThrow()
    })

    it('throws for mismatched type', () => {
      expect(() =>
        checkContext(make('after', 'create'), {
          type: 'before',
          method: 'create',
        }),
      ).toThrow()
    })

    it('throws for mismatched method', () => {
      expect(() =>
        checkContext(make('before', 'patch'), {
          type: 'before',
          method: 'create',
        }),
      ).toThrow()
    })

    it('handles type as array', () => {
      expect(() =>
        checkContext(make('before', 'create'), {
          type: ['before', 'after'],
        }),
      ).not.toThrow()
    })

    it('handles method as array', () => {
      expect(() =>
        checkContext(make('before', 'create'), {
          method: ['create', 'patch'],
        }),
      ).not.toThrow()
    })

    it('handles path option', () => {
      expect(() =>
        checkContext(
          { type: 'before', method: 'create', path: 'users' } as any,
          { path: 'users' },
        ),
      ).not.toThrow()
    })

    it('uses custom label in error message', () => {
      expect(() =>
        checkContext(make('after', 'create'), {
          type: 'before',
          label: 'myHook',
        }),
      ).toThrow("The 'myHook' hook has invalid context.")
    })

    it('uses default label when not provided', () => {
      expect(() =>
        checkContext(make('after', 'create'), { type: 'before' }),
      ).toThrow("The 'anonymous' hook has invalid context.")
    })
  })
})
