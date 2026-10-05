import type { HookContext, Id, NextFunction, Query } from '@feathersjs/feathers'
import {
  changesTopLevel,
  resolveBoolean,
  topLevelKey,
} from '../../common/index.js'
import type { PredicateFn } from '../../types.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import { count } from '../../utils/count/count.util.js'
import {
  fetchStored,
  resultWith,
} from '../../utils/define-stash/call-fetches.js'
import type { ItemsById } from '../../utils/define-stash/call-fetches.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import { patchBatch } from '../../utils/patch-batch/patch-batch.util.js'
import { patchMany } from '../../utils/patch-many/patch-many.util.js'

export type CounterCacheOptions<H extends HookContext = HookContext> = {
  /**
   * The service of the parent items, which hold the count.
   */
  service: string
  /**
   * The field of the items of this service that holds the id of their
   * parent.
   */
  key: string
  /**
   * The field of the parent items that holds the count.
   */
  field: string
  /**
   * Only the items that match it count, e.g. `{ deletedAt: null }`. A `patch`
   * of one of its fields updates the counts as well.
   */
  where?: Query
  /**
   * Whether the call waits for the counts to be updated. Can be a boolean or
   * a predicate that receives the `HookContext`.
   *
   * @default true
   */
  blocking?: boolean | PredicateFn<H>
  /**
   * Called when updating the counts fails while not blocking. Without it,
   * the error is swallowed. In `blocking` mode it is thrown to the caller.
   */
  onError?: (error: any, context: H) => void
}

/**
 * Keeps a count of the items of this service on their parent item, like
 * `commentCount` on a post - through `create`, `remove`, and a `patch` or
 * `update` that moves an item to another parent.
 *
 * After the call, the items of every parent the call touched are counted
 * again, with `count` - so the count can't drift, whatever adapter, and
 * `where` can narrow what counts. Parents with an equal count are patched with
 * a single call. A `patch` that changes neither `key` nor a field of `where`
 * doesn't touch the counts at all.
 *
 * Register it as an `around` hook, or as a `before` and an `after` hook: it
 * needs to know the parents before the call as well.
 *
 * @example
 * ```ts
 * import { counterCache } from 'feathers-utils/hooks'
 *
 * const commentCount = counterCache({
 *   service: 'posts',
 *   key: 'postId',
 *   field: 'commentCount',
 *   where: { deletedAt: null },
 * })
 *
 * app.service('comments').hooks({
 *   around: { create: [commentCount], update: [commentCount], patch: [commentCount], remove: [commentCount] },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/counter-cache.html
 */
export function counterCache<H extends HookContext = HookContext>(
  options: CounterCacheOptions<H>,
) {
  const where = options.where ?? {}
  // the fields whose change moves an item between the counts
  const read = new Set([
    topLevelKey(options.key),
    ...Object.keys(where).map(topLevelKey),
  ])

  /** the calls that touch the counts, with their items before the call */
  const touching = new WeakMap<HookContext, Promise<ItemsById | undefined>>()

  const before = (context: H) => {
    if (
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

  const updateCounts = async (
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

    const counts = await Promise.all(
      Array.from(parents.values(), async (parent) => ({
        id: parent,
        [options.field]: await count(context.app, context.path, {
          query: { ...where, [options.key]: parent },
        }),
      })),
    )

    // parents with an equal count share a write
    const parentService = context.app.service(options.service)
    const idField = getIdField(parentService)
    await Promise.all(
      patchBatch(counts, { id: 'id' }).map(([id, data, params]) =>
        id != null
          ? parentService.patch(id, data)
          : patchMany(context.app, options.service, data, {
              query: { [idField]: params!.query!.id },
            }),
      ),
    )
  }

  const after = async (context: H) => {
    const fetched = touching.get(context)
    if (!fetched) return
    touching.delete(context)

    const itemsBefore = await fetched
    if (await resolveBoolean(options.blocking, context, true)) {
      await updateCounts(context, itemsBefore)
      return
    }
    // in the background - a rejection must not go unhandled
    updateCounts(context, itemsBefore).catch((error) =>
      options.onError?.(error, context),
    )
  }

  function hook(context: H): Promise<void>
  function hook(context: H, next: NextFunction): Promise<void>
  async function hook(context: H, next?: NextFunction): Promise<void> {
    checkContext(context, {
      type: ['before', 'after', 'around'],
      method: ['create', 'update', 'patch', 'remove'],
      label: 'counterCache',
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
