import type { HookContext, Id, NextFunction } from '@feathersjs/feathers'
import {
  changesTopLevel,
  resolveBoolean,
  toArray,
  topLevelKey,
} from '../../common/index.js'
import type { MaybeArray, Promisable } from '../../internal.utils.js'
import type { PredicateFn } from '../../types.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import {
  fetchStored,
  resultWith,
} from '../../utils/define-stash/call-fetches.js'
import type { ItemsById } from '../../utils/define-stash/call-fetches.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import { patchBatch } from '../../utils/patch-batch/patch-batch.util.js'
import { patchMany } from '../../utils/patch-many/patch-many.util.js'

export type AggregateOptions<H extends HookContext = HookContext> = {
  /**
   * The service of the parent items, which hold the aggregated values.
   */
  service: string
  /**
   * The field of the items of this service that holds the id of their
   * parent.
   */
  key: string
  /**
   * The fields of the items of this service the values are computed from. A
   * `patch` that changes none of them, nor `key`, leaves the parents alone -
   * with `[]`, only a change of `key` updates them. Without it, every `patch`
   * does.
   */
  from?: MaybeArray<string>
  /**
   * Computes the values of all parents the call touched, at once: gets their
   * ids and returns the fields to patch into each, in the same order.
   *
   * @example
   * ```ts
   * compute: (postIds, context) =>
   *   Promise.all(
   *     postIds.map(async (postId) => ({
   *       commentCount: await count(context.app, 'comments', { query: { postId } }),
   *     })),
   *   )
   * ```
   */
  compute: (parentIds: Id[], context: H) => Promisable<Record<string, any>[]>
  /**
   * Whether the call waits for the parents to be updated. Can be a boolean
   * or a predicate that receives the `HookContext`.
   *
   * @default true
   */
  blocking?: boolean | PredicateFn<H>
  /**
   * Called when updating the parents fails while not blocking. Without it,
   * the error is swallowed. In `blocking` mode it is thrown to the caller.
   */
  onError?: (error: any, context: H) => void
}

/**
 * Keeps values on parent items that are computed from their child items -
 * the items of this service - like a `commentCount` or an `orderTotal`:
 * through `create`, `remove`, and a `patch` or `update` that changes a child
 * or moves it to another parent.
 *
 * After the call, `compute` gets the ids of every parent the call touched -
 * before and after it, so a move updates both parents - and returns their
 * values, which are patched into them. Parents with equal values share a
 * write. A `patch` that changes neither `key` nor a field of `from` doesn't
 * touch the parents at all.
 *
 * Computing the values from all children, e.g. with `count`, keeps them from
 * drifting - unlike an `$inc`, which is not portable either.
 *
 * Register it as an `around` hook, or as a `before` and an `after` hook: it
 * needs the parents before the call as well.
 *
 * @example
 * ```ts
 * import { aggregate } from 'feathers-utils/hooks'
 * import { count } from 'feathers-utils/utils'
 *
 * const commentCount = aggregate({
 *   service: 'posts',
 *   key: 'postId',
 *   from: ['deletedAt'],
 *   compute: (postIds, context) =>
 *     Promise.all(
 *       postIds.map(async (postId) => ({
 *         commentCount: await count(context.app, 'comments', {
 *           query: { postId, deletedAt: null },
 *         }),
 *       })),
 *     ),
 * })
 *
 * app.service('comments').hooks({
 *   around: { create: [commentCount], update: [commentCount], patch: [commentCount], remove: [commentCount] },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/aggregate.html
 */
export function aggregate<H extends HookContext = HookContext>(
  options: AggregateOptions<H>,
) {
  // the fields whose change touches the parents - none given: all of them
  const read =
    options.from === undefined
      ? undefined
      : new Set([
          topLevelKey(options.key),
          ...toArray(options.from).map(topLevelKey),
        ])

  /** the calls that touch the parents, with their items before the call */
  const touching = new WeakMap<HookContext, Promise<ItemsById | undefined>>()

  const before = (context: H) => {
    if (
      read &&
      context.method === 'patch' &&
      !changesTopLevel(context.data ?? {}, read)
    ) {
      return
    }
    // only the id and the key - a create has no items yet
    touching.set(
      context,
      context.method === 'create'
        ? Promise.resolve(undefined)
        : fetchStored(context, [options.key]),
    )
  }

  const updateParents = async (
    context: H,
    itemsBefore: ItemsById | undefined,
  ) => {
    // the parents before and after the call, each once
    const parents = new Map<string, Id>()
    const add = (item: any) => {
      const parent = item?.[options.key]
      if (parent != null) parents.set(String(parent), parent)
    }
    if (itemsBefore) for (const { item } of itemsBefore.values()) add(item)
    for (const item of await resultWith(context, [options.key])) add(item)
    if (!parents.size) return

    const ids = [...parents.values()]
    const values = await options.compute(ids, context)
    if (!Array.isArray(values) || values.length !== ids.length) {
      throw new Error(
        `aggregate: compute returned ${Array.isArray(values) ? values.length : 'no'} values for ${ids.length} parents - it has to return one per parent, in the same order`,
      )
    }

    // parents with equal values share a write
    const parentService = context.app.service(options.service)
    const idField = getIdField(parentService)
    await Promise.all(
      patchBatch(
        ids.map((id, i) => ({ ...values[i], [idField]: id })),
        { id: idField },
      ).map(([id, data, params]) =>
        id != null
          ? parentService.patch(id, data)
          : patchMany(context.app, options.service, data, params),
      ),
    )
  }

  const after = async (context: H) => {
    const fetched = touching.get(context)
    if (!fetched) return
    touching.delete(context)

    const itemsBefore = await fetched
    if (await resolveBoolean(options.blocking, context, true)) {
      await updateParents(context, itemsBefore)
      return
    }
    // in the background - a rejection must not go unhandled
    updateParents(context, itemsBefore).catch((error) =>
      options.onError?.(error, context),
    )
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'after', 'around'],
      method: ['create', 'update', 'patch', 'remove'],
      label: 'aggregate',
    })

    if (context.type === 'before') {
      before(context)
      // the fetch has to finish before the call changes the items
      await touching.get(context)
      return
    }
    if (context.type === 'after') return await after(context)

    before(context)
    await touching.get(context)
    if (next) await next()
    await after(context)
  }

  return hook
}
