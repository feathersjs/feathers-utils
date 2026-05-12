/* eslint-disable @typescript-eslint/no-this-alias */
import type { HookContext } from '@feathersjs/feathers'
import { assert, expect, vi } from 'vitest'
import { iffElse } from './iff-else.hook.js'
import { or } from '../../predicates/or/or.predicate.js'
import { and } from '../../predicates/and/and.predicate.js'
import { clone } from '../../common/index.js'

let hook: any
let hookBefore: any
let hookAfter: any
let hookFcnSyncCalls: any
let hookFcnAsyncCalls: any
let hookFcnCalls: any
let predicateParam1: any
let predicateParam2: any
let predicateParam3: any
let predicateParam4: any
let context: any
let predicateTrueContext: any
let hookFcnSyncContext: any
let hookFcnAsyncContext: any
let hookFcnContext: any

const hookFcnSync = function (this: any, hook: any) {
  hookFcnSyncContext = this

  hookFcnSyncCalls = +1
  hook.data.first = hook.data.first.toLowerCase()

  return hook
}

const hookFcnAsync = function (this: any, hook: any) {
  hookFcnAsyncContext = this

  return new Promise<HookContext>((resolve) => {
    hookFcnAsyncCalls = +1
    hook.data.first = hook.data.first.toLowerCase()

    resolve(hook)
  })
}

const hookFcn = function (this: any, hook: any, _cb: any) {
  hookFcnContext = this

  hookFcnCalls = +1

  return hook
}

const predicateTrue = function (
  this: any,
  hook: any,
  more2?: any,
  more3?: any,
  more4?: any,
): true {
  predicateTrueContext = this

  predicateParam1 = hook
  predicateParam2 = more2
  predicateParam3 = more3
  predicateParam4 = more4

  return true
}

describe('services iffElse', () => {
  beforeEach(() => {
    hookBefore = {
      type: 'before',
      method: 'create',
      data: { first: 'John', last: 'Doe' },
    }
    hookAfter = {
      type: 'before',
      method: 'create',
      data: { first: 'john', last: 'Doe' },
    }
    hook = clone(hookBefore)
    hookFcnSyncCalls = 0
    hookFcnAsyncCalls = 0
  })

  describe('runs single hook', () => {
    it('when true', () => {
      return iffElse(
        true,
        hookFcnSync,
        hookFcnAsync,
      )(hook).then((hook: any) => {
        assert.deepEqual(hook, hookAfter)
        assert.equal(hookFcnSyncCalls, 1)
        assert.equal(hookFcnAsyncCalls, 0)
        assert.deepEqual(hook, hookAfter)
      })
    })

    it('when false', () => {
      return iffElse(
        false,
        hookFcnSync,
        hookFcnAsync,
      )(hook).then((hook: any) => {
        assert.deepEqual(hook, hookAfter)
        assert.equal(hookFcnSyncCalls, 0)
        assert.equal(hookFcnAsyncCalls, 1)
        assert.deepEqual(hook, hookAfter)
      })
    })
  })

  describe('runs multiple hooks', () => {
    it('when true', () => {
      return iffElse(
        true,
        [hookFcnSync, hookFcnAsync, hookFcn],
        [],
      )(hook).then((hook: any) => {
        assert.deepEqual(hook, hookAfter)
        assert.equal(hookFcnSyncCalls, 1)
        assert.equal(hookFcnAsyncCalls, 1)
        assert.equal(hookFcnCalls, 1)
        assert.deepEqual(hook, hookAfter)
      })
    })

    it('when false', () => {
      return iffElse(false, undefined, [hookFcnSync, hookFcnAsync, hookFcn])(
        hook,
      ).then((hook: any) => {
        assert.deepEqual(hook, hookAfter)
        assert.equal(hookFcnSyncCalls, 1)
        assert.equal(hookFcnAsyncCalls, 1)
        assert.equal(hookFcnCalls, 1)
        assert.deepEqual(hook, hookAfter)
      })
    })
  })

  describe('predicate gets right params', () => {
    it('when true', () => {
      return iffElse(
        predicateTrue,
        [hookFcnSync, hookFcnAsync, hookFcn],
        undefined,
      )(hook).then(() => {
        assert.deepEqual(predicateParam1, hook, 'param1')
        assert.strictEqual(predicateParam2, undefined, 'param2')
        assert.strictEqual(predicateParam3, undefined, 'param3')
        assert.strictEqual(predicateParam4, undefined, 'param4')
      })
    })

    it('and passes on correct params', () => {
      return iffElse(
        and(predicateTrue),
        [hookFcnSync, hookFcnAsync, hookFcn],
        [],
      )(hook).then(() => {
        assert.deepEqual(predicateParam1, hook, 'param1')
        assert.strictEqual(predicateParam2, undefined, 'param2')
        assert.strictEqual(predicateParam3, undefined, 'param3')
        assert.strictEqual(predicateParam4, undefined, 'param4')
      })
    })

    it('or passes on correct params', () => {
      return iffElse(
        or(predicateTrue),
        [hookFcnSync, hookFcnAsync, hookFcn],
        [],
      )(hook).then(() => {
        assert.deepEqual(predicateParam1, hook, 'param1')
        assert.strictEqual(predicateParam2, undefined, 'param2')
        assert.strictEqual(predicateParam3, undefined, 'param3')
        assert.strictEqual(predicateParam4, undefined, 'param4')
      })
    })
  })

  describe('predicate and hooks get right context', () => {
    beforeEach(() => {
      context = { service: 'abc' }
      predicateTrueContext = undefined
      hookFcnSyncContext = undefined
      hookFcnAsyncContext = undefined
      hookFcnContext = undefined
    })

    it('services', () => {
      return iffElse(
        predicateTrue,
        [hookFcnSync, hookFcnAsync, hookFcn],
        undefined,
      )
        .call(context, hook)
        .then((hook: any) => {
          assert.deepEqual(hook, hookAfter)
          assert.equal(hookFcnSyncCalls, 1)
          assert.equal(hookFcnAsyncCalls, 1)
          assert.equal(hookFcnCalls, 1)
          assert.deepEqual(hook, hookAfter)

          assert.deepEqual(predicateTrueContext, { service: 'abc' })
          assert.deepEqual(hookFcnSyncContext, { service: 'abc' })
          assert.deepEqual(hookFcnAsyncContext, { service: 'abc' })
          assert.deepEqual(hookFcnContext, { service: 'abc' })
        })
    })
  })

  describe('around hooks', () => {
    it('runs trueHooks and then next() when predicate is truthy', async () => {
      const next = vi.fn()

      await iffElse(true, hookFcnSync, hookFcnAsync)(hook, next)

      assert.equal(hookFcnSyncCalls, 1)
      assert.equal(hookFcnAsyncCalls, 0)
      expect(next).toHaveBeenCalledOnce()
    })

    it('runs falseHooks and then next() when predicate is falsy', async () => {
      const next = vi.fn()

      await iffElse(false, hookFcnSync, hookFcnAsync)(hook, next)

      assert.equal(hookFcnSyncCalls, 0)
      assert.equal(hookFcnAsyncCalls, 1)
      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() even when no hooks are provided for the branch', async () => {
      const next = vi.fn()

      await iffElse(true, undefined, undefined)(hook, next)

      expect(next).toHaveBeenCalledOnce()
    })

    it('awaits async predicate then runs trueHooks and next()', async () => {
      const next = vi.fn()
      const asyncTrue = () => Promise.resolve(true)

      await iffElse(asyncTrue, hookFcnSync, hookFcnAsync)(hook, next)

      assert.equal(hookFcnSyncCalls, 1)
      assert.equal(hookFcnAsyncCalls, 0)
      expect(next).toHaveBeenCalledOnce()
    })

    it('calls next() after inner hooks finish, not before', async () => {
      const order: string[] = []
      const slowHook = async (h: any) => {
        await new Promise((r) => setTimeout(r, 5))
        order.push('inner')
        return h
      }
      const next = vi.fn(async () => {
        order.push('next')
      })

      await iffElse(true, slowHook, undefined)(hook, next)

      assert.deepEqual(order, ['inner', 'next'])
    })
  })
})
