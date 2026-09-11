import { copy } from 'fast-copy'
import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { HookType, MethodName, PredicateContextSync } from '../../types.js'
import { toArray } from '../../common/index.js'
import {
  isContext,
  type IsContextOptions,
} from '../../predicates/is-context/is-context.predicate.js'

/**
 * Anything that accepts a regular hook map: an `Application` (records every
 * service) or a single service (records only that one).
 */
export type RecordHooksTarget = {
  hooks: (map: any) => any
}

/**
 * What to record, by the same criteria as {@link isContext} — plus how to
 * record it. An omitted criterion does not narrow, and an array matches any of
 * its values.
 */
export type RecordHooksOptions = {
  /**
   * Which hook type to record in, which is also what gets registered. Pass an
   * array to record in several — each call is then recorded once per type. An
   * `around` hook records on the way in, before the `before` hooks run.
   *
   * Recording in more than one type without `snapshot` records the *same*
   * context object twice, because Feathers reuses one context per call.
   *
   * @default 'before'
   */
  type?: IsContextOptions['type']
  /**
   * Only record these services, by path. Defaults to every service of the
   * target — which is a single service anyway, unless an app was passed.
   */
  path?: IsContextOptions['path']
  /**
   * Only record these methods. Defaults to every method, custom ones included.
   */
  method?: IsContextOptions['method']
  /**
   * Record a snapshot instead of the live context, so later hooks cannot
   * rewrite what was recorded. `data`, `result` and `params.query` are copied;
   * `app`, `service` and the rest of `params` stay by reference, because deep
   * copying those would clone the whole application.
   *
   * @default false
   */
  snapshot?: boolean
}

/**
 * The recorded contexts of one hook type, per method and in call order. A
 * method that was not recorded reads as `[]`, so `calls.before.get` needs no
 * guard; `Object.keys` lists only the methods actually recorded.
 */
export type RecordedMethods = Record<MethodName, HookContext[]>

export type RecordedHooks = {
  /** What the `before` hook recorded, per method. */
  before: RecordedMethods
  /** What the `after` hook recorded, per method. */
  after: RecordedMethods
  /** What the `error` hook recorded, per method. */
  error: RecordedMethods
  /** What the `around` hook recorded, per method. */
  around: RecordedMethods
  /**
   * Every recorded context, in call order, across all services, methods and
   * hook types — narrow it with any predicate, `isContext` included.
   */
  all: HookContext[]
  /**
   * Forget the recorded calls the predicate matches — without one,
   * everything recorded so far. Recording continues either way.
   *
   * Any predicate will do, `isContext` included:
   * `reset(isContext({ path: 'users' }))`.
   */
  reset: (predicate?: PredicateContextSync) => void
  /**
   * Stop recording. The hook stays registered — Feathers has no way to
   * unregister one — it just stops collecting, so what was recorded before
   * stays readable and `start()` picks it back up.
   */
  stop: () => void
  /**
   * Record again after `stop()` — for the calls a test makes to set itself up
   * and does not want in the record. Recording is on to begin with.
   */
  start: () => void
}

/**
 * Copies the parts of a context a later hook is liable to change, and leaves
 * the rest by reference.
 *
 * A `HookContext` cannot be spread: `app`, `service`, `method` and `path` live
 * on a per-service prototype, and `params`/`data` are accessors there that read
 * and write the context's own `arguments` array. So the snapshot keeps the
 * prototype and gets its own copy of `arguments` — without that copy, writing
 * `params` on the snapshot would write straight back into the live context.
 */
const snapshotContext = (context: HookContext): HookContext => {
  // a plain map: the mapped type from `getOwnPropertyDescriptors` inherits
  // `arguments` as readonly, which is exactly the entry we need to replace
  const descriptors = {
    ...Object.getOwnPropertyDescriptors(context),
  } as PropertyDescriptorMap
  const args = (context as any).arguments

  if (Array.isArray(args)) {
    descriptors.arguments = { ...descriptors.arguments, value: [...args] }
  }

  const snapshot = Object.create(
    Object.getPrototypeOf(context),
    descriptors,
  ) as HookContext

  if (context.params) {
    snapshot.params = { ...context.params }
    if (context.params.query) {
      snapshot.params.query = copy(context.params.query)
    }
  }

  if (context.data !== undefined) {
    snapshot.data = copy(context.data)
  }

  if (context.result !== undefined) {
    snapshot.result = copy(context.result)
  }

  return snapshot
}

/**
 * The methods of one hook type: a map that answers `[]` for a method nothing
 * was recorded under, so a test can assert on a method that was never called
 * without a guard.
 */
const createMethods = () => {
  const recorded: Record<string, HookContext[]> = {}

  return {
    methods: new Proxy(recorded, {
      get: (target, key, receiver) =>
        typeof key === 'string' && !Reflect.has(target, key)
          ? []
          : Reflect.get(target, key, receiver),
    }) as RecordedMethods,
    push: (method: string, context: HookContext) => {
      ;(recorded[method] ??= []).push(context)
    },
    clear: () => {
      for (const method of Object.keys(recorded)) {
        delete recorded[method]
      }
    },
  }
}

/**
 * Pins the hook type a call was recorded in onto the recorded context.
 *
 * Feathers keeps one context per call and sets `context.type` back to
 * `'around'` once the hook chain moves on, so a recorded context would
 * otherwise forget which hook saw it. Pinning it keeps `isContext({ type })`
 * honest on the record — for `reset()` and for every predicate a test runs
 * over `all` itself.
 *
 * Without `snapshot`, the carrier is a view whose prototype is the live
 * context: `data`, `result` and `params` still read through to it, only `type`
 * is the recorded one.
 */
const withType = (context: HookContext, type: HookType): HookContext => {
  const recorded: HookContext = Object.create(context)

  Object.defineProperty(recorded, 'type', {
    value: type,
    enumerable: true,
    configurable: true,
    writable: true,
  })

  return recorded
}

/**
 * Record every call that passes through a service or an application, so a test
 * can assert what was requested — and how often — without standing up a spy per
 * method.
 *
 * Pass an app to record all of its services, or a single service to record just
 * that one; `path`, `method` and `type` narrow it further. The typical use is
 * proving a cache, a debounce or a local-first store did *not* go to the
 * server, which is awkward to assert on results alone.
 *
 * The record is indexed by hook type and method — `calls.before.get` — and
 * every entry is a plain array, so it composes with any predicate, `isContext`
 * included. So does `reset()`.
 *
 * By default the live `HookContext` is recorded. That object keeps mutating as
 * the call travels through the remaining hooks, so if you assert on `data` or
 * `params.query` *after* the call resolved, pass `snapshot: true`.
 *
 * @example
 * ```ts
 * import { recordHooks } from 'feathers-utils/testing'
 *
 * const calls = recordHooks(app)
 *
 * await app.service('users').find({ query: { name: 'jane' } })
 *
 * expect(calls.before.find).toHaveLength(1)
 * expect(calls.before.create).toHaveLength(0)
 * expect(calls.before.find[0].params.query).toEqual({ name: 'jane' })
 * ```
 *
 * @example
 * ```ts
 * import { isContext } from 'feathers-utils/predicates'
 *
 * // one method of one service, or everything that service was asked to do
 * expect(calls.before.find.filter(isContext({ path: 'users' }))).toHaveLength(1)
 * expect(calls.all.filter(isContext({ path: 'users' }))).toHaveLength(1)
 *
 * // and forget one service's calls without forgetting the rest
 * calls.reset(isContext({ path: 'users' }))
 * ```
 *
 * @example
 * ```ts
 * // both sides of two methods of one service, with `data` as it came in
 * const calls = recordHooks(app, {
 *   path: 'users',
 *   method: ['create', 'patch'],
 *   type: ['before', 'after'],
 *   snapshot: true,
 * })
 *
 * await app.service('users').create({ name: 'jane' })
 *
 * expect(calls.before.create[0].data).toEqual({ name: 'jane' })
 * expect(calls.after.create[0].result).toMatchObject({ name: 'jane' })
 * ```
 *
 * @see https://utils.feathersjs.com/testing/record-hooks.html
 */
export function recordHooks(
  target: RecordHooksTarget,
  options?: RecordHooksOptions,
): RecordedHooks {
  const { type = 'before', snapshot = false, ...criteria } = options ?? {}

  const types = [...new Set(toArray(type))]
  // `type` is not part of the gate: it decided which hooks were registered
  const shouldRecord = isContext(criteria)

  const all: HookContext[] = []
  const indexed = {
    before: createMethods(),
    after: createMethods(),
    error: createMethods(),
    around: createMethods(),
  }

  let recording = true

  const collect = (context: HookContext) => {
    all.push(context)
    indexed[context.type].push(context.method, context)
  }

  const record = (context: HookContext, hookType: HookType) => {
    if (!recording || !shouldRecord(context)) {
      return
    }

    collect(withType(snapshot ? snapshotContext(context) : context, hookType))
  }

  target.hooks(
    Object.fromEntries(
      types.map((hookType) => [
        hookType,
        {
          all: [
            hookType === 'around'
              ? async (context: HookContext, next: NextFunction) => {
                  record(context, hookType)
                  await next()
                }
              : (context: HookContext) => {
                  record(context, hookType)
                },
          ],
        },
      ]),
    ),
  )

  return {
    before: indexed.before.methods,
    after: indexed.after.methods,
    error: indexed.error.methods,
    around: indexed.around.methods,
    all,
    reset: (predicate) => {
      // without a predicate there is nothing to spare, so `reset()` keeps none
      const kept = predicate ? all.filter((context) => !predicate(context)) : []

      all.length = 0
      for (const methods of Object.values(indexed)) {
        methods.clear()
      }

      for (const context of kept) {
        collect(context)
      }
    },
    stop: () => {
      recording = false
    },
    start: () => {
      recording = true
    },
  }
}
