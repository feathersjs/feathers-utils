import type { HookContext } from '@feathersjs/feathers'
import type { HookType, MethodName } from '../../types.js'
import {
  isContext,
  type IsContextOptions,
} from '../../predicates/is-context/is-context.predicate.js'
import type { UnpackMaybeArray } from '../../internal.utils.js'

type NarrowedContext<H extends HookContext, O> = H &
  (O extends { path: infer P }
    ? [P] extends [undefined | null]
      ? unknown
      : { path: UnpackMaybeArray<P> }
    : unknown) &
  (O extends { type: infer T }
    ? [T] extends [undefined | null]
      ? unknown
      : { type: UnpackMaybeArray<T> }
    : unknown) &
  (O extends { method: infer M }
    ? [M] extends [undefined | null]
      ? unknown
      : { method: UnpackMaybeArray<M> }
    : unknown)

export type CheckContextOptions<H extends HookContext = HookContext> =
  IsContextOptions<H> & {
    label?: string
  }

/**
 * Validates that the hook context matches the expected type(s) and method(s).
 * Throws an error if the context is invalid, preventing hooks from running in
 * unsupported configurations. Typically used internally by other hooks.
 * Also narrows the context type based on the passed options.
 *
 * @example
 * ```ts
 * import { checkContext } from 'feathers-utils/utils'
 *
 * const myHook = (context) => {
 *   checkContext(context, ['before', 'around'], ['create', 'patch'], 'myHook')
 *   // or with options object:
 *   checkContext(context, { type: ['before', 'around'], method: ['create', 'patch'], label: 'myHook' })
 *   // context.type is now 'before' | 'around', context.method is now 'create' | 'patch'
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/check-context.html
 */
export function checkContext<
  H extends HookContext,
  const O extends CheckContextOptions<NoInfer<H>>,
>(context: H, options: O): asserts context is NarrowedContext<H, O>
export function checkContext<
  H extends HookContext,
  const T extends HookType | HookType[] | null | undefined = undefined,
  const M extends MethodName | MethodName[] | null | undefined = undefined,
>(
  context: H,
  type?: T,
  methods?: M,
  label?: string,
): asserts context is NarrowedContext<H, { type: T; method: M }>
export function checkContext<H extends HookContext = HookContext>(
  context: H,
  typeOrOptions?:
    | HookType
    | HookType[]
    | CheckContextOptions<NoInfer<H>>
    | null,
  methods?: MethodName | MethodName[] | null,
  label = 'anonymous',
): void {
  let options: IsContextOptions
  let hookLabel: string

  if (
    typeOrOptions != null &&
    typeof typeOrOptions === 'object' &&
    !Array.isArray(typeOrOptions)
  ) {
    const { label: optLabel, ...rest } = typeOrOptions
    options = rest
    hookLabel = optLabel ?? 'anonymous'
  } else {
    options = {
      method: methods ?? undefined,
      type: typeOrOptions ?? undefined,
    }
    hookLabel = label
  }

  if (!isContext(options)(context)) {
    throw new Error(`The '${hookLabel}' hook has invalid context.`)
  }
}
