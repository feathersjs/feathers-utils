import type { MethodName, Multi } from '../types.js'

const resolve = (multi: Multi, method: MethodName): boolean =>
  Array.isArray(multi) ? multi.includes(method) : multi

/**
 * Resolves whether a service allows changing multiple items in a single call
 * for the given method.
 *
 * An explicit `multi` wins over the service's own configuration. Otherwise the
 * adapter's `allowsMulti`/`options.multi` is used. Services that declare
 * nothing (e.g. custom services) are assumed to allow it.
 *
 * @example
 * ```ts
 * allowsMulti(app.service('todos'), 'remove') // => false for `multi: false`
 * allowsMulti(app.service('todos'), 'remove', true) // => true
 * ```
 */
export const allowsMulti = (
  service: any,
  method: MethodName,
  multi?: Multi,
): boolean => {
  if (multi != null) {
    return resolve(multi, method)
  }

  if (typeof service?.allowsMulti === 'function') {
    return !!service.allowsMulti(method)
  }

  const serviceMulti = service?.options?.multi

  return serviceMulti == null ? true : resolve(serviceMulti, method)
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('allowsMulti', () => {
    it('prefers an explicit multi option', () => {
      const service = { options: { multi: true } }

      expect(allowsMulti(service, 'remove', false)).toBe(false)
      expect(allowsMulti({ options: { multi: false } }, 'remove', true)).toBe(
        true,
      )
      expect(allowsMulti(service, 'remove', ['patch'])).toBe(false)
      expect(allowsMulti(service, 'patch', ['patch'])).toBe(true)
    })

    it("uses the service's allowsMulti", () => {
      const service = {
        allowsMulti: (method: string) => method === 'patch',
        options: { multi: true },
      }

      expect(allowsMulti(service, 'patch')).toBe(true)
      expect(allowsMulti(service, 'remove')).toBe(false)
    })

    it("falls back to the service's multi option", () => {
      expect(allowsMulti({ options: { multi: true } }, 'remove')).toBe(true)
      expect(allowsMulti({ options: { multi: false } }, 'remove')).toBe(false)
      expect(allowsMulti({ options: { multi: ['remove'] } }, 'remove')).toBe(
        true,
      )
      expect(allowsMulti({ options: { multi: ['patch'] } }, 'remove')).toBe(
        false,
      )
    })

    it('assumes multi for services that declare nothing', () => {
      expect(allowsMulti({}, 'remove')).toBe(true)
      expect(allowsMulti({ options: {} }, 'remove')).toBe(true)
      expect(allowsMulti(undefined, 'remove')).toBe(true)
    })
  })
}
