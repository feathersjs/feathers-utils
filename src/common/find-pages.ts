import type { Params } from '@feathersjs/feathers'
import { addToQuery } from '../utils/add-to-query/add-to-query.util.js'
import { isEqual } from '../helpers/is-equal/is-equal.helper.js'

type PaginateOption = { default?: number; max?: number }

/** What `iterateFind` and `chunkFind` take - documented there. */
export type FindPagesOptions<P extends Params = Params> = {
  params?: P & { paginate?: PaginateOption }
  keyset?: boolean
}

/**
 * The pages of a `find`, one after the other - shared by `iterateFind` and
 * `chunkFind`. Pages by `$skip`, or by the id with the `keyset` option.
 */
export async function* findPages(
  service: any,
  options: FindPagesOptions | undefined,
  defaultLimit?: number,
): AsyncGenerator<any[], void, unknown> {
  if (options?.keyset) {
    yield* keysetPages(service, options)
    return
  }

  const params = {
    ...options?.params,
    query: {
      ...(options?.params?.query ?? {}),
      $limit: options?.params?.query?.$limit ?? defaultLimit,
      $skip: options?.params?.query?.$skip ?? 0,
    },
    paginate: {
      default: options?.params?.paginate?.default ?? 10,
      max: options?.params?.paginate?.max ?? 100,
    },
  }

  let $skip = params.query.$skip
  let result

  do {
    // a fresh params object per page: the service may hold on to the last one
    result = await service.find({
      ...params,
      query: { ...params.query, $skip },
    })

    // Guard against an infinite loop: an empty page never advances $skip, so
    // `total > $skip` could stay true forever (e.g. $limit:0, or a stale total
    // when items are concurrently removed / filtered out by hooks).
    if (!result.data.length) {
      break
    }

    yield result.data

    $skip += result.data.length
  } while (result.total > $skip)
}

async function* keysetPages(
  service: any,
  options: FindPagesOptions,
): AsyncGenerator<any[], void, unknown> {
  const idField: string = service.id ?? 'id'
  const { $sort, $limit, $skip, $select, ...query } =
    options.params?.query ?? {}

  if ($sort && Object.keys($sort).length) {
    throw new Error(
      `keyset pagination sorts by '${idField}', so it can't take a $sort`,
    )
  }

  const { paginate, ...params } = options.params ?? {}
  const limit = Math.min(
    $limit ?? paginate?.default ?? 10,
    paginate?.max ?? 100,
  )
  const select =
    Array.isArray($select) && !$select.includes(idField)
      ? [...$select, idField]
      : $select

  let skip: number | undefined = $skip
  let after: { id: unknown } | undefined

  while (true) {
    let pageQuery: Record<string, any> = {
      ...query,
      $sort: { [idField]: 1 },
      $limit: limit,
      ...(skip !== undefined && { $skip: skip }),
      ...(select !== undefined && { $select: select }),
    }
    if (after) {
      // through `addToQuery`, so a condition on the id in `query` is kept
      pageQuery = addToQuery(pageQuery, { [idField]: { $gt: after.id } })
    }

    const page: any[] = await service.find({
      ...params,
      query: pageQuery,
      paginate: false,
    })

    if (!page.length) {
      return
    }

    // read before the page is handed out: the loop may change its items
    const lastId = page[page.length - 1]?.[idField]
    if (lastId == null || (after && isEqual(lastId, after.id))) {
      throw new Error(
        `keyset pagination made no progress: the items need their '${idField}', sorted by \`$sort\``,
      )
    }

    yield page

    after = { id: lastId }
    skip = undefined
  }
}
