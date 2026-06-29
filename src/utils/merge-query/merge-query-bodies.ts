import type { MergeQueryMode } from './merge-query.util.js'
import { isEmptyObject } from '../../common/is-empty-object.js'
import { dedupeBranches } from '../../common/dedupe-branches.js'
import { flattenAndBranches } from '../../common/flatten-and-branches.js'
import { logicalBranches } from './logical-branches.js'
import { hasConflict } from './has-conflict.js'

type QueryRecord = Record<string, any>

/**
 * Merges two query bodies (filters already removed) according to the mode.
 * Internal helper for {@link mergeQuery}.
 *
 * - `target` / `source`: precedence merge (that side wins on conflict).
 * - `combine`: the two bodies always become branches of a single `$or`.
 * - `intersect`: non-conflicting bodies merge flat; on conflict they become
 *   branches of a single `$and`.
 *
 * Logical-only bodies (`{ $or: [...] }` for combine, `{ $and: [...] }` for
 * intersect) are flattened into the result and their branches de-duplicated.
 */
export function mergeQueryBodies(
  target: QueryRecord,
  source: QueryRecord,
  mode: MergeQueryMode,
): QueryRecord {
  if (mode === 'target') {
    return { ...source, ...target }
  }
  if (mode === 'source') {
    return { ...target, ...source }
  }

  if (isEmptyObject(target)) {
    return { ...source }
  }
  if (isEmptyObject(source)) {
    return { ...target }
  }

  const op = mode === 'combine' ? '$or' : '$and'

  const targetBranches = logicalBranches(target, op)
  const sourceBranches = logicalBranches(source, op)

  // For intersect (AND) the top level is itself an implicit AND, so two
  // conflict-free bodies can be merged flat. For combine (OR) there is no flat
  // representation — combine always produces an `$or`.
  if (
    op === '$and' &&
    !targetBranches &&
    !sourceBranches &&
    !hasConflict(target, source)
  ) {
    return { ...target, ...source }
  }

  const collected = [
    ...(targetBranches ?? [target]),
    ...(sourceBranches ?? [source]),
  ]

  // under `$and`, hoist any nested `$and` so the result never nests `$and` in `$and`
  const branches = dedupeBranches(
    op === '$and' ? flattenAndBranches(collected) : collected,
  )

  if (branches.length === 0) {
    return {}
  }
  if (branches.length === 1) {
    return { ...branches[0] }
  }
  return { [op]: branches }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('mergeQueryBodies', () => {
    it('target / source precedence', () => {
      expect(mergeQueryBodies({ id: 1 }, { id: 2, a: 3 }, 'target')).toEqual({
        id: 1,
        a: 3,
      })
      expect(mergeQueryBodies({ id: 1 }, { id: 2, a: 3 }, 'source')).toEqual({
        id: 2,
        a: 3,
      })
    })

    it('returns the other side when one is empty', () => {
      expect(mergeQueryBodies({}, { id: 1 }, 'combine')).toEqual({ id: 1 })
      expect(mergeQueryBodies({ id: 1 }, {}, 'intersect')).toEqual({ id: 1 })
    })

    it('combine always produces an $or, even for disjoint keys', () => {
      expect(mergeQueryBodies({ a: 1 }, { b: 2 }, 'combine')).toEqual({
        $or: [{ a: 1 }, { b: 2 }],
      })
    })

    it('combine flattens and dedupes $or branches', () => {
      expect(
        mergeQueryBodies(
          { $or: [{ id: 1 }, { id: 2 }] },
          { $or: [{ id: 2 }, { id: 3 }] },
          'combine',
        ),
      ).toEqual({ $or: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    })

    it('combine collapses to a single body', () => {
      expect(mergeQueryBodies({ id: 1 }, { id: 1 }, 'combine')).toEqual({
        id: 1,
      })
    })

    it('intersect merges disjoint keys flat', () => {
      expect(mergeQueryBodies({ id: 1 }, { userId: 2 }, 'intersect')).toEqual({
        id: 1,
        userId: 2,
      })
    })

    it('intersect wraps conflicts in $and', () => {
      expect(mergeQueryBodies({ id: 1 }, { id: 2 }, 'intersect')).toEqual({
        $and: [{ id: 1 }, { id: 2 }],
      })
    })

    it('intersect flattens $and branches', () => {
      expect(
        mergeQueryBodies(
          { $and: [{ id: 1 }, { id: 2 }] },
          { $and: [{ id: 3 }] },
          'intersect',
        ),
      ).toEqual({ $and: [{ id: 1 }, { id: 2 }, { id: 3 }] })
    })

    it('intersect hoists a nested $and instead of nesting it', () => {
      expect(
        mergeQueryBodies(
          { $or: ['u'] },
          { $or: ['c'], $and: [{ $nor: ['n'] }] },
          'intersect',
        ),
      ).toEqual({ $and: [{ $or: ['u'] }, { $or: ['c'] }, { $nor: ['n'] }] })
    })
  })
}
