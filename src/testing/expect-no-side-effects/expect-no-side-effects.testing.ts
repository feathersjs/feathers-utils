import { copy } from 'fast-copy'
import { deepFreeze } from '../deep-freeze/deep-freeze.testing.js'
import { isDeepEqual } from '../../common/index.js'

/**
 * Asserts that `fn` never writes into `input` - typically the params (and so
 * the query) a hook or util is handed, which belong to the caller, who may
 * reuse them for the next call.
 *
 * Runs `fn` twice: on a mutable copy of `input`, which has to come out
 * unchanged - that catches any write that lasts, one from sloppy-mode code
 * included - and on a deep-frozen copy, where a write throws in strict mode
 * even when it would have been undone before `fn` returns. Both runs have to
 * produce the same output, which is returned for further assertions.
 *
 * Works with any test runner: it throws on failure and needs no `expect`. The
 * errors carry `actual` and `expected`, so vitest shows a diff.
 *
 * @example
 * ```ts
 * import { expectNoSideEffects, runHook } from 'feathers-utils/testing'
 * import { disablePagination } from 'feathers-utils/hooks'
 *
 * it('does not mutate the params', async () => {
 *   const params = await expectNoSideEffects(
 *     { query: { $limit: -1 } },
 *     async (params) => {
 *       const context = await runHook(disablePagination(), {
 *         type: 'before',
 *         method: 'find',
 *         params,
 *       })
 *       return context.params
 *     },
 *   )
 *
 *   expect(params).toEqual({ query: {}, paginate: false })
 * })
 * ```
 *
 * @see https://utils.feathersjs.com/testing/expect-no-side-effects.html
 */
export async function expectNoSideEffects<T, R>(
  input: T,
  fn: (input: T) => R | Promise<R>,
): Promise<R> {
  const mutable = copy(input)
  const expected = await fn(mutable)
  if (!isDeepEqual(mutable, input)) {
    throw assertionError(
      'expectNoSideEffects: fn wrote into its input',
      mutable,
      input,
    )
  }

  let actual: R
  try {
    actual = await fn(deepFreeze(copy(input)))
  } catch (error) {
    throw new Error(
      `expectNoSideEffects: fn failed on a frozen copy of its input, though not on a mutable one - it writes into it, if only for a moment: ${(error as Error)?.message}`,
      { cause: error },
    )
  }
  if (!isDeepEqual(actual, expected)) {
    throw assertionError(
      'expectNoSideEffects: fn returned something else for a frozen copy of its input than for a mutable one',
      actual,
      expected,
    )
  }

  return actual
}

/** `actual` and `expected` make vitest print a diff, as for its own errors */
const assertionError = (message: string, actual: unknown, expected: unknown) =>
  Object.assign(new Error(message), {
    name: 'AssertionError',
    actual,
    expected,
    showDiff: true,
  })
