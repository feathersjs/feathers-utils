import type { HookContext } from "@feathersjs/feathers";
import { copy } from "fast-copy";
import { getResultIsArray } from "../get-result-is-array/get-result-is-array.util.js";
import type { DispatchOption } from "../../types.js";
import type { ResultSingleHookContext } from "../../utility-types/hook-context.js";

export type ReplaceResultOptions = {
  /**
   * Also (or only) write to `context.dispatch`. `true` writes dispatch, `'both'`
   * writes both `result` and `dispatch`. When dispatch is requested and not yet
   * present, it is seeded from a clone of `context.result`.
   */
  dispatch?: DispatchOption;
};

/**
 * Replaces `context.result` (and/or `context.dispatch`) wholesale with the given
 * items, preserving the original shape: single item, array, or paginated `{ data }`.
 * This is the explicit inverse of `getResultIsArray`.
 *
 * @example
 * ```ts
 * import { getResultIsArray, replaceResult } from 'feathers-utils/utils'
 *
 * const { result } = getResultIsArray(context)
 * replaceResult(context, result.filter((item) => item.public))
 * ```
 *
 * @see https://utils.feathersjs.com/utils/replace-result.html
 */
export function replaceResult<H extends HookContext = HookContext>(
  context: H,
  result: ResultSingleHookContext<H>[],
  options?: ReplaceResultOptions,
): H {
  if (!!options?.dispatch && !context.dispatch) {
    context.dispatch = copy(context.result);
  }

  const write = (dispatch: boolean) => {
    const { isArray, key } = getResultIsArray(context, { dispatch });

    if (!isArray) {
      context[key] = result[0];
    } else if (!Array.isArray(context[key]) && context[key]?.data) {
      context[key].data = result;
    } else {
      context[key] = result;
    }
  };

  if (options?.dispatch === "both") {
    write(true);
    write(false);
  } else {
    write(!!options?.dispatch);
  }

  return context;
}
