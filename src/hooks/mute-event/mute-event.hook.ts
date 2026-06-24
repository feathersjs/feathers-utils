import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { PredicateFn } from '../../types.js'

export type MuteEventOptions<H extends HookContext = HookContext> = {
  /**
   * Only mute when this is truthy. Can be a boolean or a predicate that
   * receives the `HookContext`. Defaults to always muting.
   *
   * @example isProvider('server')
   */
  when?: boolean | PredicateFn<H>
}

/**
 * Suppresses the service event for the current call by setting `context.event`
 * to `null`. Feathers emits the standard `created`/`updated`/`patched`/`removed`
 * event (the value of `context.event`) after the method runs; setting it to
 * `null` prevents that emission so real-time subscribers and channels are not
 * notified.
 *
 * Useful for seeding, migrations and internal syncs that should not trigger
 * downstream listeners. Works as a `before`, `after` or `around` hook.
 *
 * @example
 * ```ts
 * import { muteEvent } from 'feathers-utils/hooks'
 * import { isProvider } from 'feathers-utils/predicates'
 *
 * app.service('users').hooks({
 *   before: {
 *     all: [muteEvent()],                              // mute every call
 *     create: [muteEvent({ when: isProvider('server') })], // only server calls
 *   }
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/mute-event.html
 */
export const muteEvent = <H extends HookContext = HookContext>(
  options?: MuteEventOptions<H>,
) => {
  const when = options?.when

  return async (context: H, next?: NextFunction): Promise<void> => {
    const should =
      typeof when === 'function' ? await when(context) : (when ?? true)

    if (should) {
      context.event = null
    }

    if (next) {
      await next()
    }
  }
}
