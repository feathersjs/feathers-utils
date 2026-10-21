import type { HookContext } from '@feathersjs/feathers'
import { generated } from './generated.hook.js'

type User = {
  id: number
  firstName: string
  lastName: string
  fullName: string
}

describe('generated types', () => {
  it('takes any fields without a type', () => {
    generated({
      fields: 'fullName',
      from: ['firstName', 'lastName'],
      generate: (items) => items.map(() => ({ fullName: 'x' })),
    })
  })

  it('types the fields and the items by the type', () => {
    generated<HookContext, User>({
      fields: 'fullName',
      from: ['firstName', 'lastName'],
      generate: (users) => {
        expectTypeOf(users).toEqualTypeOf<Partial<User>[]>()
        return users.map(({ firstName }) => ({ fullName: firstName }))
      },
    })

    generated<HookContext, User>({
      // @ts-expect-error not a field of User
      fields: 'name',
      from: 'firstName',
      generate: (users) => users,
    })
  })
})
