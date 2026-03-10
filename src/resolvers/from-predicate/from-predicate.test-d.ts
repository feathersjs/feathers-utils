import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { feathers } from '@feathersjs/feathers'
import { expectTypeOf } from 'vitest'
import { fromPredicate } from './from-predicate.js'
import { isProvider } from '../../predicates/is-provider/is-provider.predicate.js'
import { resolveResult } from '../resolve-result/resolve-result.js'
import { omit } from '../helpers/omit/omit.js'
import type { HookFunction } from '../../types.js'
import type { ResolverCondition } from '../resolver-condition.js'

type User = {
  id: number
  name: string
  password: string
}

const app = feathers<{ users: MemoryService<User> }>()
type App = typeof app
type Ctx = HookContext<App, MemoryService<User>>

function useHook<H extends HookContext>(..._hooks: HookFunction<H>[]) {}

it('fromPredicate returns a ResolverCondition', () => {
  const condition = fromPredicate(isProvider('external'))
  expectTypeOf(condition).toEqualTypeOf<ResolverCondition<HookContext>>()
})

it('fromPredicate works with omit in typed context', () => {
  useHook<Ctx>(resolveResult({
    password: omit(fromPredicate(isProvider('external'))),
  }))
})
