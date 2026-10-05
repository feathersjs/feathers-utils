import { feathers } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { findAll } from './find-all.util.js'

type User = { id: number; name: string }

describe('findAll types', () => {
  it('returns the items of the service, as an array', () => {
    const app = feathers<{ users: MemoryService<User> }>()

    expectTypeOf(findAll(app, 'users')).toEqualTypeOf<Promise<User[]>>()
  })

  it('takes only the paths of the app', () => {
    const app = feathers<{ users: MemoryService<User> }>()

    // @ts-expect-error not a service of the app
    findAll(app, 'posts')
  })
})
