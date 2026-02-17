import type { HookContext, NextFunction, Params } from '@feathersjs/feathers'
import type { Promisable } from './internal.utils.js'

export const hookTypes = ['around', 'before', 'after', 'error'] as const
export type HookType = (typeof hookTypes)[number]

export const methodNames = [
  'find',
  'get',
  'create',
  'update',
  'patch',
  'remove',
] as const
export type MethodName = (typeof methodNames)[number] | ({} & string) // allow custom methods

export type TransportName = 'socketio' | 'rest' | 'external' | 'server'

export type ContextFunctionSync<T, H extends HookContext = HookContext> = (
  context: H,
) => T
export type ContextFunctionAsync<T, H extends HookContext = HookContext> = (
  context: H,
) => Promise<T>
export type ContextFunction<T, H extends HookContext = HookContext> = (
  context: H,
) => T | Promise<T>

export type PredicateContextSync<H extends HookContext = HookContext> = (
  context: H,
) => boolean
export type PredicateContextAsync<H extends HookContext = HookContext> = (
  context: H,
) => Promise<boolean>

export type PredicateFn<H extends HookContext = HookContext> = (
  context: H,
) => boolean | Promise<boolean>

export type PredicateItemWithContext<T = any> = (
  item: T,
  context: HookContext,
) => boolean

export type TransformerFn<
  T = Record<string, any>,
  H extends HookContext = HookContext,
> = (
  item: T,
  options: { context: H; i: number },
) => Promisable<T | undefined | void>

export declare type HookFunction<H extends HookContext = HookContext> = (
  context: H,
  next?: NextFunction,
) => Promise<H | void> | H | void

export type TransformParamsFn<P extends Params = Params> = (
  params: P,
) => P | void

export type DispatchOption = boolean | 'both'
