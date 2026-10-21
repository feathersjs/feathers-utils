import type { PropertyPath } from '../types.js'
import { castPath } from './to-path.js'
import { getPath } from '../helpers/get-path/get-path.helper.js'
import { hasPath } from '../helpers/has-path/has-path.helper.js'

/** Returned by {@link getContextPath} for a path the context does not have. */
export const MISSING_PATH: unique symbol = Symbol('missing path')

const isEnumerable = Object.prototype.propertyIsEnumerable

/**
 * Whether `key` is one `context.toJSON()` would copy: an enumerable string key
 * of the context or of any prototype on its chain.
 */
const isJsonKey = (context: object, key: string): boolean => {
  for (let o: object | null = context; o; o = Object.getPrototypeOf(o)) {
    if (isEnumerable.call(o, key)) return true
  }
  return false
}

/**
 * Reads `path` from a hook context the way `hasPath`/`getPath` would read it
 * from `context.toJSON()` — `params`, `data` & co. live on the context's
 * prototype, so the own-property check of `hasPath` misses them on the context
 * itself — without building that JSON object on every call. Returns
 * `MISSING_PATH` where `hasPath` would be `false`.
 *
 * @example
 * ```ts
 * const value = getContextPath(context, 'params.user.id')
 * if (value === MISSING_PATH) throw new Forbidden()
 * ```
 */
export const getContextPath = (context: any, path: PropertyPath): unknown => {
  if (!context.toJSON) {
    return hasPath(context, path) ? getPath(context, path) : MISSING_PATH
  }

  const keys = castPath(path, context)
  const first = keys[0]
  if (typeof first !== 'string' || !isJsonKey(context, first)) {
    return MISSING_PATH
  }

  const head = context[first]
  if (keys.length === 1) return head

  const rest = keys.slice(1)
  return hasPath(head, rest) ? getPath(head, rest) : MISSING_PATH
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest
  const { feathers } = await import('@feathersjs/feathers')

  /** The previous reading: `hasPath`/`getPath` on `context.toJSON()`. */
  const viaJson = (context: any, path: PropertyPath) => {
    const json = context.toJSON ? context.toJSON() : context
    return hasPath(json, path) ? getPath(json, path) : MISSING_PATH
  }

  const realContext = async (params: Record<string, any>) => {
    let captured: any
    const app = feathers().use('todos', {
      async create(data: any) {
        return data
      },
    })
    app.service('todos').hooks({
      before: {
        create: [
          (context: any) => {
            captured = context
          },
        ],
      },
    })
    await app.service('todos').create({ title: 'a' }, params)
    return captured
  }

  describe('getContextPath', () => {
    it('reads like hasPath/getPath on context.toJSON()', async () => {
      const context = await realContext({
        user: { id: 1, nested: { undef: undefined } },
        list: [1],
        provider: 'rest',
      })
      context.custom = { a: null }

      const paths: PropertyPath[] = [
        'params.user.id',
        'params.user',
        'params',
        'data.title',
        'method',
        'path',
        'id',
        'result',
        'custom.a',
        'custom.a.b',
        'params.user.nested.undef',
        'params.user.missing',
        'params.list[0]',
        'params.list[1]',
        'missing',
        'missing.deep',
        'toString',
        'constructor',
        ['params', 'user', 'id'],
        [],
      ]

      for (const path of paths) {
        expect(getContextPath(context, path), String(path)).toStrictEqual(
          viaJson(context, path),
        )
      }
    })

    it('falls back to the context itself without toJSON', () => {
      const context = { params: { user: { id: 1 } } }
      expect(getContextPath(context, 'params.user.id')).toBe(1)
      expect(getContextPath(context, 'params.nope')).toBe(MISSING_PATH)
      expect(getContextPath({}, 'toString')).toBe(MISSING_PATH)
    })
  })
}
