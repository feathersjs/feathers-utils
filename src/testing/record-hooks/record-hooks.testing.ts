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
   * Which hook types to record in, which is also what gets registered. Each
   * call is recorded once per type, so by default a successful call shows up
   * in `before` and in `after`, and a failed one in `before` and in `error`.
   *
   * `around` is not recorded unless asked for: at the moment it records it
   * sees exactly what `before` sees, so it would only add another entry per
   * call. Narrow this to a single type when one entry per call matters.
   *
   * Recording in more than one type without `snapshot` records the *same*
   * context object more than once, because Feathers reuses one context per
   * call — each entry keeps the type it was recorded in, nothing else differs.
   * `waitFor` counts per call regardless; it is `all` and the per-type views
   * that show a call once per type.
   *
   * @default ['before', 'after', 'error']
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
   * Only record calls addressing this record — `null` for the multi variants
   * of `update`/`patch`/`remove`. Defaults to every call.
   */
  id?: IsContextOptions['id']
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

/**
 * What to match a recorded call against: the same criteria as {@link isContext}
 * — `path`, `method`, `type`, `id` — or any predicate, for the conditions
 * criteria cannot express.
 */
export type RecordedHooksMatch = IsContextOptions | PredicateContextSync

export type RecordedHooksWaitOptions = {
  /**
   * Which calls to wait for. Omitted, every recorded call counts.
   */
  context?: RecordedHooksMatch
  /**
   * How many matching calls to wait for — a lower bound: the wait resolves as
   * soon as that many are there, and says nothing about further ones. For an
   * exact assertion, add `quietFor` and assert on what it resolves with.
   *
   * Calls, not recorded entries: a call the recorder saw in `before` and again
   * in `after` counts once, and the wait resolves with one context per call —
   * the first one recorded for it. Pin `type` in `context` to choose which
   * side that is; `calls.all` is the entry-level view.
   *
   * `0` inverts the wait: it resolves once the window has passed *without* a
   * matching call, and rejects as soon as one is recorded.
   *
   * @default 1
   */
  count?: number
  /**
   * What `count` counts: every matching call in the record (`'record'`), or
   * only the ones recorded from this `waitFor` call onwards (`'now'`).
   *
   * `'now'` is how "no *further* call" is expressed — `{ count: 0, since:
   * 'now' }` ignores what is already recorded instead of rejecting on it, and
   * unlike `resetBefore` it leaves that evidence in place for the assertions
   * that follow. `resetAfter` would forget that evidence again, so the two are
   * refused together.
   *
   * It is the *calls* already out that are ignored, not merely their entries:
   * one of them coming back while the wait runs is not a further call, so an
   * `after` to a `before` from before the baseline neither counts nor
   * rejects.
   *
   * Mind the order, as with `resetBefore`: the baseline is taken when
   * `waitFor` is called, so this belongs to "act, start the wait, act again,
   * then await it". To check after the fact instead, use `quietFor` and assert
   * on how many calls it resolves with — that counts the ones already
   * recorded.
   *
   * @default 'record'
   */
  since?: 'record' | 'now'
  /**
   * Resolve only after this many milliseconds without a new matching call, and
   * resolve with *every* match seen — the debounce-shaped wait: trigger
   * something, let it settle, then assert the exact number of calls.
   *
   * One context per call, as with `count`. The silence, though, is pushed out
   * by every matching entry, a call *coming back* included — so a call that
   * returns inside the window keeps the wait open. A call slower than the
   * window still resolves it while that call is in flight.
   *
   * The silence is only watched once `count` is reached, and `timeout` stays
   * the hard deadline: a stream of calls that never goes quiet rejects there.
   * It therefore has to be shorter than `timeout`.
   */
  quietFor?: number
  /**
   * Reject after this many milliseconds. Pass `false` to wait indefinitely.
   *
   * Waiting for calls resolves as soon as they arrive, so a generous window
   * costs a passing test nothing. `count: 0` is the other way round — it
   * always waits the window out — so it defaults to a short one, and `false`
   * is refused there because it could never settle.
   *
   * @default 5000 — with `count: 0`, 50
   */
  timeout?: number | false
  /**
   * Forget the matching calls before waiting, so that only what happens from
   * here on counts — for waiting on the *next* call while earlier ones are
   * still in the record. Like `reset`, it forgets only what the criteria
   * match.
   *
   * Mind the order: the window starts when `waitFor` is called, so this
   * belongs to "start the wait, act, then await it". In the other shape — act
   * first, then check the record — it would forget the very call in question,
   * and a plain `reset()` before acting is what you want.
   *
   * @default false
   */
  resetBefore?: boolean
  /**
   * Forget the matching calls once the wait has resolved — the contexts it
   * resolves with are yours either way, so a test can wait through several
   * phases without a `reset()` in between. A wait that *failed* keeps the
   * record, since that is the evidence for what went wrong.
   *
   * Forgetting goes by the same criteria, so it takes every entry of a
   * matching call, both sides of it included. That contradicts `since: 'now'`,
   * which keeps what is already recorded, and the two are refused together.
   *
   * @default false
   */
  resetAfter?: boolean
}

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
   * Every recorded context, in the order it was recorded, across all services,
   * methods and hook types — narrow it with any predicate, `isContext`
   * included.
   *
   * One *call* appears once per recorded hook type, so with the default types
   * a successful call is two entries here. `before`/`after`/`error` are the
   * per-call view, and `waitFor` counts calls rather than these entries.
   */
  all: HookContext[]
  /**
   * Forget the matching recorded calls — without criteria, everything
   * recorded so far. Recording continues either way.
   *
   * Takes what `waitFor` takes: `reset({ path: 'users' })`, or a predicate.
   */
  reset: (match?: RecordedHooksMatch) => void
  /**
   * Resolve with the matching recorded calls, as soon as there are `count` of
   * them — counting the ones already in the record. Rejects on timeout. This
   * is what replaces a `sleep` before reading the record:
   *
   * ```ts
   * const [context] = await calls.waitFor({ context: { method: 'create' } })
   * ```
   *
   * With `count: 0` it waits for the opposite and resolves with `[]`: nothing
   * matching within the window, rejecting the moment something does — so a
   * test that proves a call did *not* happen fails immediately instead of
   * sleeping and asserting afterwards. A match that is already in the record
   * rejects right away; `since: 'now'` is how to ignore it.
   *
   * A wait started *before* the action it watches can reject while that action
   * is still running, and node logs an unhandled rejection for the moment
   * between the rejection and your `await`. It is harmless — attach the
   * expectation before the action to keep the log quiet.
   */
  waitFor: (options?: RecordedHooksWaitOptions) => Promise<HookContext[]>
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
 * The hook types a recorder registers unless told otherwise: the three phases
 * of a call — it went out, it came back, it failed. `around` is left out; see
 * `RecordHooksOptions.type`.
 */
const recordedByDefault = ['before', 'after', 'error'] as const

/** Criteria become the predicate they describe; a predicate is already one. */
const toPredicate = (match?: RecordedHooksMatch) =>
  match === undefined || typeof match === 'function' ? match : isContext(match)

/** `\`before\`, \`after\`` — a readable list for an error message. */
const list = (items: readonly string[]) =>
  items.map((item) => `\`${item}\``).join(', ')

/**
 * How a recorded call reads in an error message: `before users.find`, or
 * `before users.patch(3)` when the call addressed a record.
 */
const describeCall = (context: HookContext) =>
  `${context.type} ${String(context.path)}.${context.method}` +
  (context.id !== undefined ? `(${String(context.id)})` : '')

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
 * included. So do `reset()` and `waitFor()`.
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
 * calls.reset({ path: 'users' })
 * ```
 *
 * @example
 * ```ts
 * // wait for a call instead of sleeping and then reading the record
 * const [context] = await calls.waitFor({ context: { method: 'create' } })
 * expect(context.data).toEqual({ name: 'jane' })
 *
 * // prove nothing reaches the service at all, failing the moment one does
 * calls.reset()
 * await readThroughCache()
 * await calls.waitFor({ context: { path: 'users' }, count: 0 })
 * ```
 *
 * @example
 * ```ts
 * // "one request went out, prove no second one follows" — the baseline is
 * // taken here, so the first call stays in the record as evidence
 * await app.service('users').find({})
 * const quiet = calls.waitFor({
 *   context: { path: 'users' },
 *   count: 0,
 *   since: 'now',
 * })
 * await readThroughCache()
 * await quiet
 * expect(calls.before.find).toHaveLength(1)
 * ```
 *
 * @example
 * ```ts
 * // the same thing after the fact: let a debounce settle, then assert the
 * // exact number of calls — no `sleep`, and it returns them
 * await store.load()
 * await store.load()
 *
 * const finds = await calls.waitFor({
 *   context: { path: 'users' },
 *   quietFor: 250,
 * })
 * expect(finds).toHaveLength(1)
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
  const {
    type = recordedByDefault,
    snapshot = false,
    ...criteria
  } = options ?? {}

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

  // a recorded entry to the live context of the call it came from. Feathers
  // reuses one context per call, so this is what tells one call recorded twice
  // — in `before` and again in `after` — from two calls, `snapshot` included.
  const callOf = new WeakMap<HookContext, HookContext>()

  let recording = true

  // notified on every newly recorded call, never on a reindex — a `reset()`
  // that keeps calls must not look like those calls happening again
  const waiters = new Set<(context: HookContext) => void>()

  const index = (context: HookContext) => {
    all.push(context)
    indexed[context.type].push(context.method, context)
  }

  const record = (context: HookContext, hookType: HookType) => {
    if (!recording || !shouldRecord(context)) {
      return
    }

    const recorded = withType(
      snapshot ? snapshotContext(context) : context,
      hookType,
    )

    // before `index`, so a waiter can resolve the call an entry belongs to
    callOf.set(recorded, context)
    index(recorded)

    // a copy: a waiter detaches itself as it settles
    for (const waiter of [...waiters]) {
      waiter(recorded)
    }
  }

  const matching = (predicate?: PredicateContextSync) =>
    predicate ? all.filter((context) => predicate(context)) : [...all]

  /** The call an entry came from — itself, if it was not recorded here. */
  const callFor = (context: HookContext) => callOf.get(context) ?? context

  /**
   * One entry per call, the first one recorded for it: what `count` counts, so
   * that a call recorded in `before` and again in `after` counts once.
   */
  const distinct = (contexts: HookContext[]) => {
    const seen = new Set<HookContext>()

    return contexts.filter((context) => {
      const call = callFor(context)

      if (seen.has(call)) {
        return false
      }

      seen.add(call)

      return true
    })
  }

  /** Drops the matching calls and rebuilds the index from what is left. */
  const forget = (predicate?: PredicateContextSync) => {
    // without a predicate there is nothing to spare, so nothing is kept
    const kept = predicate ? all.filter((context) => !predicate(context)) : []

    all.length = 0
    for (const methods of Object.values(indexed)) {
      methods.clear()
    }

    for (const context of kept) {
      index(context)
    }
  }

  /**
   * Reports every matching call to `onCall` until the returned `stop` is
   * called, or until the window passes and `onTimeout` runs instead.
   */
  const watch = (
    predicate: PredicateContextSync | undefined,
    timeout: number | false,
    onCall: (context: HookContext) => void,
    onTimeout: (recordedWhileWaiting: number) => void,
  ) => {
    const recordedBefore = all.length
    let timer: ReturnType<typeof setTimeout> | undefined

    const waiter = (context: HookContext) => {
      if (predicate && !predicate(context)) {
        return
      }
      onCall(context)
    }

    function stop() {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      waiters.delete(waiter)
    }

    if (timeout !== false) {
      timer = setTimeout(() => {
        stop()
        // calls, not entries — `matched` is counted the same way
        onTimeout(distinct(all.slice(recordedBefore)).length)
      }, timeout)
    }

    waiters.add(waiter)

    return stop
  }

  /**
   * The hook types a wait asks for that are not recorded here. A wait for one
   * of those could only ever time out, so `waitFor` says so straight away.
   */
  const unrecordedTypes = (match?: RecordedHooksMatch) => {
    if (
      match === undefined ||
      typeof match === 'function' ||
      match.type == null
    ) {
      return undefined
    }

    const requested = toArray(match.type)

    return requested.some((requestedType) => types.includes(requestedType))
      ? undefined
      : requested
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
    reset: (match) => {
      forget(toPredicate(match))
    },
    waitFor: (options) => {
      const predicate = toPredicate(options?.context)
      const count = options?.count ?? 1
      const since = options?.since ?? 'record'
      const quietFor = options?.quietFor
      const timeout = options?.timeout ?? (count === 0 ? 50 : 5000)

      if (!Number.isInteger(count) || count < 0) {
        return Promise.reject(
          new TypeError(
            `\`count\` must be a non-negative integer, got ${count}`,
          ),
        )
      }

      if (count === 0 && timeout === false) {
        return Promise.reject(
          new TypeError(
            '`count: 0` needs a window to pass, so `timeout: false` would never settle',
          ),
        )
      }

      if (count === 0 && quietFor !== undefined) {
        return Promise.reject(
          new TypeError(
            '`count: 0` rejects on the first match, so there is no quiet period to wait for',
          ),
        )
      }

      if (quietFor !== undefined && !(quietFor > 0)) {
        return Promise.reject(
          new TypeError(
            `\`quietFor\` must be a positive number of milliseconds, got ${quietFor}`,
          ),
        )
      }

      if (quietFor !== undefined && timeout !== false && quietFor >= timeout) {
        return Promise.reject(
          new TypeError(
            `\`quietFor\` (${quietFor}ms) must be shorter than \`timeout\` (${timeout}ms), or the silence could never pass`,
          ),
        )
      }

      if (options?.resetAfter && since === 'now') {
        return Promise.reject(
          new TypeError(
            "`since: 'now'` keeps what is already recorded and `resetAfter` forgets it, so the two contradict each other",
          ),
        )
      }

      const unrecorded = unrecordedTypes(options?.context)
      if (unrecorded) {
        return Promise.reject(
          new Error(
            `Waiting for the ${list(unrecorded)} hook, but this recorder records ${list(types)} — pass \`type: [${[...new Set([...types, ...unrecorded])].map((hookType) => `'${hookType}'`).join(', ')}]\` to recordHooks`,
          ),
        )
      }

      if (options?.resetBefore) {
        forget(predicate)
      }

      /** The contexts to resolve with, and the record tidied up if asked. */
      const settle = (contexts: HookContext[]) => {
        if (options?.resetAfter) {
          forget(predicate)
        }
        return contexts
      }

      const matchedSoFar = matching(predicate)
      // `since: 'now'` starts from an empty baseline, leaving the record be
      const recorded = since === 'now' ? [] : distinct(matchedSoFar)
      // ...but it remembers which calls were already out, so one of them
      // coming back is not mistaken for a further call
      const known = new Set(since === 'now' ? matchedSoFar.map(callFor) : [])

      if (count === 0) {
        if (recorded.length > 0) {
          return Promise.reject(
            new Error(
              `Expected no matching call, but \`${describeCall(recorded[0])}\` was already recorded`,
            ),
          )
        }

        return new Promise<HookContext[]>((resolve, reject) => {
          const stop = watch(
            predicate,
            timeout,
            (context) => {
              if (known.has(callFor(context))) {
                return
              }

              stop()
              reject(
                new Error(
                  `Expected no matching call within ${timeout}ms, but \`${describeCall(context)}\` was recorded`,
                ),
              )
            },
            () => resolve(settle([])),
          )
        })
      }

      if (quietFor === undefined && recorded.length >= count) {
        return Promise.resolve(settle(recorded.slice(0, count)))
      }

      return new Promise<HookContext[]>((resolve, reject) => {
        const matched = [...recorded]
        // the calls `matched` stands for, so the `after` to a counted `before`
        // does not count a second time
        const counted = new Set([...known, ...matched.map(callFor)])
        let quiet: ReturnType<typeof setTimeout> | undefined

        const clearQuiet = () => {
          if (quiet) {
            clearTimeout(quiet)
            quiet = undefined
          }
        }

        const finish = () => {
          clearQuiet()
          stop()
          resolve(settle(matched))
        }

        // every further match pushes the silence out again
        const waitForQuiet = () => {
          clearQuiet()
          quiet = setTimeout(finish, quietFor)
        }

        const stop = watch(
          predicate,
          timeout,
          (context) => {
            const call = callFor(context)

            if (!counted.has(call)) {
              counted.add(call)
              matched.push(context)
            }

            if (matched.length < count) {
              return
            }

            if (quietFor === undefined) {
              finish()
            } else {
              // every matching entry pushes the silence out, a call coming
              // back included, so a call that returns inside the window keeps
              // the wait open
              waitForQuiet()
            }
          },
          (recordedWhileWaiting) => {
            clearQuiet()
            reject(
              new Error(
                `Timeout after ${timeout}ms waiting for ${
                  quietFor !== undefined && matched.length >= count
                    ? `${quietFor}ms without a matching call`
                    : `${count} matching call${count === 1 ? '' : 's'}`
                }: ${matched.length} matched, ${recordedWhileWaiting} call${
                  recordedWhileWaiting === 1 ? '' : 's'
                } recorded while waiting`,
              ),
            )
          },
        )

        // the count can be met already, in which case the silence starts here
        if (quietFor !== undefined && matched.length >= count) {
          waitForQuiet()
        }
      })
    },
    stop: () => {
      recording = false
    },
    start: () => {
      recording = true
    },
  }
}
