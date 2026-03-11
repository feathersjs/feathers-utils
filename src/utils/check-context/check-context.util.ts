import type { HookContext } from '@feathersjs/feathers'
import type { HookType, MethodName } from '../../types.js'
import {
  isContext,
  type IsContextOptions,
} from '../../predicates/is-context/is-context.predicate.js'

export type CheckContextOptions<H extends HookContext = HookContext> =
  IsContextOptions<H> & {
    label?: string
  }

/**
 * Validates that the hook context matches the expected type(s) and method(s).
 * Throws an error if the context is invalid, preventing hooks from running in
 * unsupported configurations. Typically used internally by other hooks.
 *
 * @example
 * ```ts
 * import { checkContext } from 'feathers-utils/utils'
 *
 * const myHook = (context) => {
 *   checkContext(context, ['before', 'around'], ['create', 'patch'], 'myHook')
 *   // or with options object:
 *   checkContext(context, { type: ['before', 'around'], method: ['create', 'patch'], label: 'myHook' })
 *   // ... hook logic
 * }
 * ```
 *
 * @see https://utils.feathersjs.com/utils/check-context.html
 */
export function checkContext<H extends HookContext = HookContext>(
  context: H,
  options: CheckContextOptions<NoInfer<H>>,
): void
export function checkContext<H extends HookContext = HookContext>(
  context: H,
  type?: HookType | HookType[] | null,
  methods?: MethodName | MethodName[] | null,
  label?: string,
): void
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
