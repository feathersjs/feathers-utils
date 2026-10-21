import type { HookContext } from '@feathersjs/feathers'
import { unique } from './unique.hook.js'

type User = { id: number; tenantId: number; email: string; deletedAt: Date }

describe('unique types', () => {
  it('takes any fields without a type', () => {
    unique({ fields: 'email', where: { deletedAt: null } })
    unique({ fields: ['tenantId', 'email'] })
  })

  it('restricts fields and where to those of the type', () => {
    unique<HookContext, User>({
      fields: ['tenantId', 'email'],
      where: { deletedAt: null },
    })

    // @ts-expect-error not a field of User
    unique<HookContext, User>({ fields: 'name' })
    // @ts-expect-error not a field of User
    unique<HookContext, User>({ fields: 'email', where: { name: null } })
  })
})
