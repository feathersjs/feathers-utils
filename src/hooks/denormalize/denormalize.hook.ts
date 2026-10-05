import type { HookContext, Id, NextFunction } from '@feathersjs/feathers'
import {
  changesTopLevel,
  findAllOf,
  getPath,
  isDeepEqual,
  resolveBoolean,
  topLevelKeys,
} from '../../common/index.js'
import type { PredicateFn } from '../../types.js'
import { checkContext } from '../../utils/check-context/check-context.util.js'
import {
  fetchStored,
  resultWith,
} from '../../utils/define-stash/call-fetches.js'
import type { ItemsById } from '../../utils/define-stash/call-fetches.js'
import { getIdField } from '../../utils/get-id-field/get-id-field.util.js'
import { patchMany } from '../../utils/patch-many/patch-many.util.js'
import { generated } from '../generated/generated.hook.js'

export type DenormalizeOptions<H extends HookContext = HookContext> = {
  /**
   * The service the values come from, e.g. `users`.
   */
  source: string
  /**
   * The service the values are copied to, e.g. `posts`.
   */
  target: string
  /**
   * The field of the target items that holds the id of their source item.
   */
  key: string
  /**
   * The fields to copy, as target field: source field. The target fields
   * have to be top-level properties, the source fields may be nested paths.
   *
   * @example
   * ```ts
   * fields: { authorName: 'name', authorCity: 'address.city' }
   * ```
   */
  fields: Record<string, string>
  /**
   * Whether the call to the source service waits for the target items to be
   * updated. Can be a boolean or a predicate that receives the `HookContext`.
   *
   * @default true
   */
  blocking?: boolean | PredicateFn<H>
  /**
   * Called when updating the target items fails while not blocking. Without
   * it, the error is swallowed. In `blocking` mode it is thrown to the caller.
   */
  onError?: (error: any, context: H) => void
}

export type DenormalizeHook = {
  (context: HookContext): Promise<void>
  (context: HookContext, next: NextFunction): Promise<void>
}

export type Denormalize = {
  /**
   * For the target service: fills the target fields from the source item of
   * `key`, on `create`, `update` and a `patch` that changes `key`. Works like
   * a {@link generated} hook - register it the same way.
   */
  target: DenormalizeHook
  /**
   * For the source service: copies the source fields to the target items
   * when an `update` or `patch` changes them. Register it as an `around`
   * hook, or as a `before` and an `after` hook.
   */
  source: DenormalizeHook
}

/**
 * Copies fields from a related item and keeps them in sync, like
 * `posts.authorName` from `users.name` - so the target can be read, filtered
 * and sorted by them without a join. Returns two hooks, one for each side:
 *
 * - `target`, on the target service, fills the fields from the source item
 *   when `key` is set or changes - with a single query for all items of the
 *   call. It is a {@link generated} hook, so only it writes the fields.
 * - `source`, on the source service, copies the fields to the target items
 *   when they change - one `patchMany` per changed source item. These patches
 *   go through the hooks of the target service and send their events; the
 *   `target` hook of the same `denormalize` lets them pass.
 *
 * @example
 * ```ts
 * import { denormalize } from 'feathers-utils/hooks'
 *
 * const authorName = denormalize({
 *   source: 'users',
 *   target: 'posts',
 *   key: 'authorId',
 *   fields: { authorName: 'name' },
 * })
 *
 * app.service('posts').hooks({
 *   around: { create: [authorName.target], update: [authorName.target], patch: [authorName.target] },
 * })
 * app.service('users').hooks({
 *   around: { update: [authorName.source], patch: [authorName.source] },
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/hooks/denormalize.html
 */
export function denormalize<H extends HookContext = HookContext>(
  options: DenormalizeOptions<H>,
): Denormalize {
  const fields = Object.entries(options.fields)
  const sourceFields = fields.map(([, sourceField]) => sourceField)
  const sourceProperties = topLevelKeys(sourceFields)
  const sourcePropertySet = new Set(sourceProperties)

  // marks the patches of `source`, for `target` to let them pass
  const fromSource = Symbol('denormalize')

  /** the target fields, from the source item - `null` without one */
  const valuesOf = (source: Record<string, any> | undefined) => {
    const values: Record<string, unknown> = {}
    for (const [targetField, sourceField] of fields) {
      values[targetField] =
        source === undefined ? null : (getPath(source, sourceField) ?? null)
    }
    return values
  }

  const generatedHook = generated({
    fields: fields.map(([targetField]) => targetField),
    from: options.key,
    generate: async (items, context) => {
      const sourceService = context.app.service(options.source)
      const sourceId = getIdField(sourceService)

      // the source items, each once, with a single query
      const ids = new Map<string, Id>()
      for (const item of items) {
        const id = (item as any)[options.key]
        if (id != null) ids.set(String(id), id)
      }
      const sources = new Map<string, Record<string, any>>()
      if (ids.size) {
        const found = await findAllOf(sourceService, {
          query: {
            [sourceId]: { $in: [...ids.values()] },
            $select: [sourceId, ...sourceProperties],
          },
        })
        for (const source of found)
          sources.set(String(source[sourceId]), source)
      }

      return items.map((item) => {
        const id = (item as any)[options.key]
        return valuesOf(id == null ? undefined : sources.get(String(id)))
      })
    },
  })

  function target(context: HookContext): Promise<void>
  function target(context: HookContext, next: NextFunction): Promise<void>
  async function target(context: HookContext, next?: NextFunction) {
    if (context.params[fromSource]) {
      if (next) await next()
      return
    }
    await generatedHook(context, next as NextFunction)
  }

  /** the calls that may change the source fields, with their items before */
  const touching = new WeakMap<HookContext, Promise<ItemsById>>()

  const before = (context: HookContext) => {
    if (
      context.method === 'patch' &&
      !changesTopLevel(context.data ?? {}, sourcePropertySet)
    ) {
      return
    }
    touching.set(context, fetchStored(context, sourceProperties))
  }

  const copyToTargets = async (context: HookContext, stored: ItemsById) => {
    const idField = getIdField(context.service)
    const updates: Promise<unknown>[] = []

    for (const item of await resultWith(context, sourceProperties)) {
      const id = item[idField]
      const before = stored.get(String(id))?.item
      // only the fields that change
      const values: Record<string, unknown> = {}
      let changes = false
      for (const [targetField, sourceField] of fields) {
        const value = getPath(item, sourceField) ?? null
        if (!isDeepEqual(getPath(before, sourceField) ?? null, value)) {
          values[targetField] = value
          changes = true
        }
      }
      if (!changes) continue

      updates.push(
        patchMany(context.app, options.target, values, {
          query: { [options.key]: id },
          [fromSource]: true,
        }),
      )
    }
    await Promise.all(updates)
  }

  const after = async (context: HookContext) => {
    const fetched = touching.get(context)
    if (!fetched) return
    touching.delete(context)

    const stored = await fetched
    if (await resolveBoolean(options.blocking, context as H, true)) {
      await copyToTargets(context, stored)
      return
    }
    // in the background - a rejection must not go unhandled
    copyToTargets(context, stored).catch((error) =>
      options.onError?.(error, context as H),
    )
  }

  function source(context: HookContext): Promise<void>
  function source(context: HookContext, next: NextFunction): Promise<void>
  async function source(context: HookContext, next?: NextFunction) {
    checkContext(context, {
      type: ['before', 'after', 'around'],
      method: ['update', 'patch'],
      label: 'denormalize',
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

  return { target, source }
}
