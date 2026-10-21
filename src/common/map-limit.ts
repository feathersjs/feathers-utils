/**
 * How many calls of a per-item fallback (`createMany`, `patchMany`,
 * `removeMany`) run at the same time unless `concurrency` says otherwise.
 */
export const DEFAULT_CONCURRENCY = 10

/**
 * Maps `items` through the async `fn` with at most `limit` calls in flight and
 * resolves to the results in input order.
 *
 * Rejects with the first error. No further call starts after it; the calls
 * already running are not awaited. A `limit` of at least `items.length`
 * (e.g. `Infinity`) starts every call at once, like `Promise.all`.
 *
 * @example
 * ```ts
 * // at most 10 `remove` calls at a time
 * await mapLimit(ids, 10, (id) => service.remove(id))
 * ```
 */
export const mapLimit = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  if (!(limit >= 1)) {
    throw new TypeError(`concurrency must be at least 1, got ${limit}`)
  }

  if (limit >= items.length) {
    return await Promise.all(items.map(fn))
  }

  const results: R[] = []
  let next = 0
  let failed = false

  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++
      try {
        results[index] = await fn(items[index], index)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < limit; i++) workers.push(worker())
  await Promise.all(workers)

  return results
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  /** Resolves on the next macrotask, so calls overlap. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

  /** An async `fn` that records how many calls ran at the same time. */
  const tracked = () => {
    let running = 0
    const state = { maxRunning: 0, started: [] as number[] }
    const fn = async (item: number) => {
      state.started.push(item)
      running++
      state.maxRunning = Math.max(state.maxRunning, running)
      await tick()
      running--
      return item * 2
    }
    return { fn, state }
  }

  describe('mapLimit', () => {
    it('keeps at most `limit` calls in flight', async () => {
      const { fn, state } = tracked()
      await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, fn)
      expect(state.maxRunning).toBe(3)
    })

    it('resolves to the results in input order', async () => {
      const fn = async (item: number) => {
        // later items finish first
        await new Promise((resolve) => setTimeout(resolve, 10 - item))
        return item * 2
      }
      expect(await mapLimit([1, 2, 3, 4, 5], 2, fn)).toStrictEqual([
        2, 4, 6, 8, 10,
      ])
    })

    it('starts every call at once for a limit of at least the length', async () => {
      const { fn, state } = tracked()
      expect(await mapLimit([1, 2, 3], Infinity, fn)).toStrictEqual([2, 4, 6])
      expect(state.maxRunning).toBe(3)
    })

    it('passes the index', async () => {
      expect(
        await mapLimit(['a', 'b', 'c'], 1, async (item, i) => `${item}${i}`),
      ).toStrictEqual(['a0', 'b1', 'c2'])
    })

    it('rejects with the first error and starts no further call', async () => {
      const started: number[] = []
      const fn = async (item: number) => {
        started.push(item)
        await tick()
        if (item === 2) throw new Error('boom')
        return item
      }

      await expect(mapLimit([1, 2, 3, 4, 5, 6], 2, fn)).rejects.toThrow('boom')
      await tick()
      expect(started).toStrictEqual([1, 2, 3])
    })

    it('resolves to an empty array for no items', async () => {
      expect(await mapLimit([], 2, async () => 1)).toStrictEqual([])
    })

    it.each([0, -1, NaN])('rejects a limit of %s', async (limit) => {
      await expect(mapLimit([1], limit, async () => 1)).rejects.toThrow(
        TypeError,
      )
    })
  })
}
