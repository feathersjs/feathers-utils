import type { HookContext, NextFunction } from '@feathersjs/feathers'
import { resolveBoolean, toArray } from '../../common/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import { shouldSkip } from '../../predicates/should-skip/should-skip.predicate.js'
import type { PredicateFn } from '../../types.js'
import type {
  DataSingleHookContext,
  ResultSingleHookContext,
} from '../../utility-types/hook-context.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { defineStash } from '../../utils/define-stash/define-stash.util.js'
import type {
  Stash,
  StashedItem,
  StashTransformParams,
} from '../../utils/define-stash/define-stash.util.js'
import { getDataIsArray } from '../../utils/get-data-is-array/get-data-is-array.util.js'
import { getDataMatchIds } from './get-data-match-ids.js'
import type { DataMatch } from './get-data-match-ids.js'

export type TriggerActionOptions<H extends HookContext, T> = {
  context: H
  /** All items of the call, matching or not */
  items: StashedItem<T>[]
  subscription: TriggerSubscription<H, T>
}

export type TriggerAction<H extends HookContext, T> = (
  item: StashedItem<T>,
  options: TriggerActionOptions<H, T>,
) => Promisable<void>

export type TriggerBatchAction<H extends HookContext, T> = (
  items: StashedItem<T>[],
  options: TriggerActionOptions<H, T>,
) => Promisable<void>

export type TriggerSubscriptionOptions<
  H extends HookContext = HookContext,
  T = ResultSingleHookContext<H>,
> = {
  /**
   * Names the subscription: `params.skipHooks` skips it by this name (see
   * `shouldSkip`), and the debug log shows it.
   */
  name?: string
  /**
   * Whether the subscription applies to the call, tested once before it -
   * e.g. with `isContext` or `isProvider`.
   *
   * @example
   * ```ts
   * trigger({ iff: isContext({ path: 'posts', method: 'patch' }), action })
   * ```
   */
  iff?: boolean | PredicateFn<H>
  /**
   * Tests `context.data` before the call - on multi create every item on its
   * own, and the action only runs for the items whose data matched. Doesn't
   * match without `context.data`, e.g. on `remove`.
   *
   * On multi create, the data is paired with its result by its id, or without
   * one by its position. Data without an id doesn't match if a later hook adds
   * or removes an item, since the positions no longer line up.
   */
  data?: (data: DataSingleHookContext<H>, context: H) => Promisable<boolean>
  /**
   * Tests the item before the call. Doesn't match an item without one, e.g.
   * on `create`. Fetches the items before the call.
   *
   * @example
   * ```ts
   * trigger({ before: (post) => !post.published, action })
   * ```
   */
  before?: (before: T, context: H) => Promisable<boolean>
  /**
   * Tests the item after the call.
   *
   * @example
   * ```ts
   * trigger({ result: (post) => post.published, action })
   * ```
   */
  result?: (result: T, context: H) => Promisable<boolean>
  /**
   * Tests the item before and after the call, to compare them. Fetches the
   * items before the call.
   *
   * @example
   * ```ts
   * trigger({
   *   change: ({ before, result }) => before?.status !== result?.status,
   *   action,
   * })
   * ```
   */
  change?: (item: StashedItem<T>, context: H) => Promisable<boolean>
  /**
   * Adjusts the params of the fetches before and after the call - e.g. to
   * populate the items. See `defineStash`.
   */
  transformParams?: StashTransformParams<H>
  /**
   * Fetches the items before the call. Resolved once per call, before it.
   *
   * @default `true` with `before` or `change`, `false` otherwise
   */
  fetchBefore?: boolean | PredicateFn<H>
  /**
   * Waits for the actions before the call returns, and fails the call if one
   * of them fails. Without, the errors of the actions are logged with
   * `console.error`. Resolved once per call, before it.
   *
   * @default true
   */
  isBlocking?: boolean | PredicateFn<H>
  /**
   * Logs why the subscription skips the call or an item. Resolved once per
   * call, before it.
   *
   * @default false
   */
  debug?: boolean | PredicateFn<H>
  /**
   * Runs for every matching item. Use either `action` or `batchAction`.
   */
  action?: TriggerAction<H, T>
  /**
   * Runs once with all matching items, not at all without any. Use either
   * `action` or `batchAction`.
   */
  batchAction?: TriggerBatchAction<H, T>
}

export type TriggerSubscription<
  H extends HookContext = HookContext,
  T = ResultSingleHookContext<H>,
> = TriggerSubscriptionOptions<H, T> &
  (
    | { action: TriggerAction<H, T>; batchAction?: never }
    | { batchAction: TriggerBatchAction<H, T>; action?: never }
  )

export type TriggerOptions<
  H extends HookContext = HookContext,
  T = ResultSingleHookContext<H>,
> =
  | MaybeArray<TriggerSubscription<H, T>>
  | ((
      context: H,
    ) => Promisable<MaybeArray<TriggerSubscription<H, T>> | undefined>)

type Log = (...args: unknown[]) => void

type SubscriptionState<H extends HookContext, T> = {
  subscription: TriggerSubscription<H, T>
  debug: boolean
  isBlocking: boolean
  stash: Stash<T, H>
  /**
   * The items of `context.data` as they were when `data` tested them, and
   * whether they matched. Only set if some did and some didn't.
   */
  dataMatches?: DataMatch[]
}

/**
 * The subscriptions left after the before hook, per `trigger()` and keyed by
 * the context, which lives exactly as long as the call
 */
const callStates = new WeakMap<
  HookContext,
  Map<symbol, SubscriptionState<any, any>[]>
>()

/**
 * Runs actions for the items of `create`, `update`, `patch` and `remove`
 * calls that match the conditions of a subscription. The conditions are
 * predicates, tested against the data before the call, the items before the
 * call and the items after it. The items come from {@link defineStash}, so
 * subscriptions whose fetches have equal params share them.
 *
 * Register it as a `before` and an `after` hook, or as an `around` hook.
 *
 * @example
 * ```ts
 * import { trigger } from 'feathers-utils/hooks'
 *
 * const notifyOnPublish = trigger<PostsContext>({
 *   name: 'notifyOnPublish',
 *   before: (post) => !post.published,
 *   result: (post) => post.published,
 *   action: async ({ result }) => sendMail(result),
 * })
 *
 * app.service('posts').hooks({ around: { patch: [notifyOnPublish] } })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/trigger.html
 */
export function trigger<
  H extends HookContext = HookContext,
  T = ResultSingleHookContext<H>,
>(options: TriggerOptions<H, T>) {
  if (!options) {
    throw new Error('trigger: no subscriptions')
  }

  // every `trigger()` has its own subscriptions in the state of the call
  const token = Symbol('trigger')

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'after', 'around'],
      method: ['create', 'update', 'patch', 'remove'],
      label: 'trigger',
    })

    if (context.type === 'before')
      return await triggerBefore(context, options, token)
    if (context.type === 'after') return await triggerAfter(context, token)

    await triggerBefore(context, options, token)
    if (next) await next()
    await triggerAfter(context, token)
  }

  return hook
}

const makeLog = (
  subscription: Pick<TriggerSubscriptionOptions, 'name'>,
  context: HookContext,
  debug: boolean,
): Log =>
  debug
    ? console.log.bind(
        console,
        '[feathers-utils trigger]',
        ...(subscription.name ? [subscription.name] : []),
        context.type,
        `service('${context.path}').${context.method}()`,
      )
    : () => {}

/** An action as a promise, which rejects if the action throws synchronously */
const run = (action: () => Promisable<void>): Promise<void> =>
  new Promise((resolve) => resolve(action()))

const logError = (
  subscription: Pick<TriggerSubscriptionOptions, 'name'>,
  context: HookContext,
  error: unknown,
) =>
  console.error(
    '[feathers-utils trigger]',
    ...(subscription.name ? [subscription.name] : []),
    `service('${context.path}').${context.method}()`,
    'a non-blocking action failed:',
    error,
  )

const triggerBefore = async <H extends HookContext, T>(
  context: H,
  options: TriggerOptions<H, T>,
  token: symbol,
): Promise<void> => {
  const subscriptions =
    typeof options === 'function' ? await options(context) : options
  if (!subscriptions) return

  const states = (
    await Promise.all(
      toArray(subscriptions).map((subscription) =>
        matchBefore(subscription, context),
      ),
    )
  ).filter((state) => state !== undefined)

  for (const state of states) {
    await state.stash.stash(context)
  }

  if (states.length) {
    let stateOfCall = callStates.get(context)
    if (!stateOfCall) {
      stateOfCall = new Map()
      callStates.set(context, stateOfCall)
    }
    stateOfCall.set(token, states)
  }
}

/**
 * The state of the subscription for the call, if it applies to the call as
 * far as it can be told before it
 */
const matchBefore = async <H extends HookContext, T>(
  subscription: TriggerSubscription<H, T>,
  context: H,
): Promise<SubscriptionState<H, T> | undefined> => {
  const debug = await resolveBoolean(subscription.debug, context, false)
  const log = makeLog(subscription, context, debug)

  if (!subscription.action && !subscription.batchAction) {
    log("skipping because of no 'action' or 'batchAction'")
    return
  }

  if (!(await resolveBoolean(subscription.iff, context, true))) {
    log("skipping because of 'iff'")
    return
  }

  if (subscription.name && shouldSkip(subscription.name)(context)) {
    log("skipping because of 'params.skipHooks'")
    return
  }

  let dataMatches: DataMatch[] | undefined
  if (subscription.data) {
    const { data } = getDataIsArray(context)
    const matches = await Promise.all(
      data.map(async (item) => ({
        data: item,
        isMatch: await subscription.data!(item, context),
      })),
    )

    if (!matches.some(({ isMatch }) => isMatch)) {
      log("skipping because of 'data'")
      return
    }
    if (!matches.every(({ isMatch }) => isMatch)) {
      dataMatches = matches
    }
  }

  const [isBlocking, fetchBefore] = await Promise.all([
    resolveBoolean(subscription.isBlocking, context, true),
    resolveBoolean(
      subscription.fetchBefore,
      context,
      !!subscription.before || !!subscription.change,
    ),
  ])

  return {
    subscription,
    debug,
    isBlocking,
    stash: defineStash<T, H>({
      fetchBefore,
      transformParams: subscription.transformParams,
    }),
    dataMatches,
  }
}

const triggerAfter = async <H extends HookContext>(
  context: H,
  token: symbol,
): Promise<void> => {
  const states = callStates.get(context)?.get(token)
  if (!states) return

  const promises: Promisable<void>[] = []

  for (const state of states) {
    const { subscription } = state
    // an item that isn't there after the call - e.g. because
    // `transformParams` filters it out of the refetch - has no change
    const items = (await state.stash.stashed(context)).filter(
      ({ result }) => result !== undefined,
    )
    const matching = await filterItems(state, items, context)
    const options = { context, items, subscription }

    const running = (
      subscription.batchAction
        ? matching.length
          ? [() => subscription.batchAction!(matching, options)]
          : []
        : matching.map((item) => () => subscription.action!(item, options))
    ).map(run)

    if (state.isBlocking) {
      promises.push(...running)
    } else {
      // nobody waits for them, and an unhandled rejection ends the process
      running.forEach((promise) =>
        promise.catch((error) => logError(subscription, context, error)),
      )
    }
  }

  await Promise.all(promises)
}

/**
 * The items that match `data` (tested before the call), `result`, `before`
 * and `change`
 */
const filterItems = async <H extends HookContext, T>(
  state: SubscriptionState<H, T>,
  items: StashedItem<T>[],
  context: H,
): Promise<StashedItem<T>[]> => {
  const { subscription } = state
  const log = makeLog(subscription, context, state.debug)
  const dataMatchIds = state.dataMatches
    ? getDataMatchIds(context, state.dataMatches)
    : undefined
  const matching: StashedItem<T>[] = []

  for (const item of items) {
    if (dataMatchIds && !dataMatchIds.has(String(item.id))) {
      log("skipping because of 'data'", item.id)
      continue
    }

    if (
      subscription.result &&
      !(await subscription.result(item.result as T, context))
    ) {
      log("skipping because of 'result'", item.id)
      continue
    }

    if (
      subscription.before &&
      (item.before === undefined ||
        !(await subscription.before(item.before, context)))
    ) {
      log("skipping because of 'before'", item.id)
      continue
    }

    if (subscription.change && !(await subscription.change(item, context))) {
      log("skipping because of 'change'", item.id)
      continue
    }

    matching.push(item)
  }

  return matching
}
