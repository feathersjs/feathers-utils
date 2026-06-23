import type { Application, HookContext } from '@feathersjs/feathers'
import type { KeyOf, NeverFallback } from '../../internal.utils.js'
import type { InferFindResultSingle } from '../../utility-types/infer-service-methods.js'

/**
 * The standard Feathers service events, plus any custom event name a service
 * might emit.
 */
export type ServiceEventName =
  | 'created'
  | 'updated'
  | 'patched'
  | 'removed'
  | (string & {})

export type WaitForServiceEventOptions<Result = unknown> = {
  /**
   * Reject after this many milliseconds. Pass `false` to wait indefinitely.
   *
   * @default 5000
   */
  timeout?: number | false
  /**
   * Only resolve for events whose data passes this predicate. Receives the
   * emitted record and the `HookContext` (the second argument Feathers emits).
   */
  filter?: (data: Result, context: HookContext) => boolean
  /**
   * Abort waiting via an `AbortSignal`. The promise rejects with the signal's
   * `reason` (or a generic abort error) and all listeners are detached.
   */
  signal?: AbortSignal
}

/**
 * Service-agnostic defaults that can be bound once when currying with the app.
 * `filter` is intentionally omitted because it depends on the per-service
 * record type.
 */
export type WaitForServiceEventDefaults = Pick<
  WaitForServiceEventOptions,
  'timeout' | 'signal'
>

export type WaitForServiceEventResult<Event extends string, Result> = {
  /** The event that fired (one of the requested events). */
  event: Event
  /** The emitted record. */
  data: Result
  /** The `HookContext` Feathers emitted alongside the record. */
  context: HookContext
}

/**
 * Wait for a service event to fire and resolve with the emitted record. Useful
 * in tests to await the result of an asynchronous service event, a bit like
 * `promisify` for Feathers events.
 *
 * Curried: bind the `app` (and optional defaults) once, then call the returned
 * function per service/event. The resolved `data` is typed as the service's
 * record type, and `event` is the union of the requested events.
 *
 * Feathers emits events as `emit(event, record, context)` and fires one event
 * per record, so each resolution carries a single record and its `HookContext`.
 *
 * @example
 * ```ts
 * import { waitForServiceEvent } from 'feathers-utils/utils'
 *
 * const app = feathers()
 * const waitForEvent = waitForServiceEvent(app)
 *
 * // Wait for the next `users` record to be created.
 * const { data: user } = await waitForEvent('users', 'created')
 *
 * // Wait for a specific record, with a custom timeout and filter.
 * const { event, data } = await waitForEvent(
 *   'users',
 *   ['created', 'patched'],
 *   { filter: (user) => user.email === 'jane@example.com', timeout: 1000 },
 * )
 * ```
 *
 * @see https://utils.feathersjs.com/utils/wait-for-service-event.html
 */
export function waitForServiceEvent<Services>(
  app: Application<Services>,
  defaultOptions?: WaitForServiceEventDefaults,
) {
  return function waitForEvent<
    Path extends KeyOf<Services>,
    const Event extends ServiceEventName,
    Service extends Services[Path] = Services[Path],
    Result = NeverFallback<InferFindResultSingle<Service>, unknown>,
  >(
    servicePath: Path,
    eventOrEvents: Event | Event[],
    options?: WaitForServiceEventOptions<Result>,
  ): Promise<WaitForServiceEventResult<Event, Result>> {
    const events = (
      Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents]
    ) as Event[]

    const timeout = options?.timeout ?? defaultOptions?.timeout ?? 5000
    const filter = options?.filter
    const signal = options?.signal ?? defaultOptions?.signal

    const service = app.service(servicePath)

    return new Promise<WaitForServiceEventResult<Event, Result>>(
      (resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined

        // [event, listener] pairs so we know which event fired (Node's
        // EventEmitter does not pass the event name to the listener) and can
        // detach each listener precisely on cleanup.
        const listeners = events.map((event) => {
          const listener = (data: Result, context: HookContext) => {
            if (filter && !filter(data, context)) {
              return
            }
            cleanup()
            resolve({ event, data, context })
          }
          return [event, listener] as const
        })

        const abortError = () =>
          signal?.reason ??
          new Error(
            `Aborted waiting for event "${events.join(', ')}" on service "${String(servicePath)}"`,
          )

        const onAbort = () => {
          cleanup()
          reject(abortError())
        }

        function cleanup() {
          if (timer) {
            clearTimeout(timer)
            timer = undefined
          }
          for (const [event, listener] of listeners) {
            ;(service as any).off(event, listener)
          }
          signal?.removeEventListener('abort', onAbort)
        }

        if (signal?.aborted) {
          reject(abortError())
          return
        }

        if (timeout !== false) {
          timer = setTimeout(() => {
            cleanup()
            reject(
              new Error(
                `Timeout waiting for event "${events.join(', ')}" on service "${String(servicePath)}"`,
              ),
            )
          }, timeout)
        }

        signal?.addEventListener('abort', onAbort, { once: true })

        for (const [event, listener] of listeners) {
          ;(service as any).on(event, listener)
        }
      },
    )
  }
}
