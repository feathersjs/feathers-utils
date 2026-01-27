import type { Id, Params } from '@feathersjs/feathers'
import { dequal as deepEqual } from 'dequal'
import type { KeyOf } from '../../internal.utils.js'

export type PatchBatchOptions<IdKey extends string> = {
  /** the key of the id property */
  id?: IdKey
}

export type PatchBatchResultItem<T = Record<string, unknown>, P = Params> = [
  Id | null,
  T,
  P | undefined,
]

/**
 * Batch patching utility that takes an array of items to be changed and returns an array of arguments to be called with the `patch` method.
 *
 * This utility is useful when you need to patch multiple items with varying data in as few requests as possible.
 *
 * @example
 * ```ts
 * const items = [
 *   { id: 1, value: 10 },
 *   { id: 2, value: 10 },
 *   { id: 3, value: 20 },
 * ];
 *
 * const batched = patchBatch(items, { id: 'id' });
 * // batched will be:
 * // [
 * //   [null, { value: 10 }, { query: { id: { $in: [1, 2] } } }],
 * //   [3, { value: 20 }, undefined],
 * // ]
 *
 * await Promise.all(batched.map(args => service.patch(...args)));
 * ```
 *
 * @see https://utils.feathersjs.com/utils/patch-batch.html
 */
export function patchBatch<
  T extends Record<string, any>,
  IdKey extends KeyOf<T>,
  P extends Params,
  R extends Omit<T, IdKey> = Omit<T, IdKey>,
>(
  items: T[],
  options?: PatchBatchOptions<IdKey>,
): PatchBatchResultItem<R, P>[] {
  const map: { ids: Id[]; data: R }[] = []

  const idKey = options?.id ?? 'id'

  for (const _data of items) {
    const data = _data as unknown as R
    const id = _data[idKey]
    delete (data as any)[idKey as any]

    const index = map.findIndex((item) => {
      return deepEqual(item.data, data)
    })

    if (index === -1) {
      map.push({ ids: [id], data })
    } else {
      map[index].ids.push(id)
    }
  }

  return map.map(({ ids, data }) => {
    return ids.length === 1
      ? ([ids[0], data, undefined] as PatchBatchResultItem<R, P>)
      : ([
          null,
          data,
          {
            query: {
              [idKey]: { $in: ids },
            },
          },
        ] as PatchBatchResultItem<R, P>)
  })
}
