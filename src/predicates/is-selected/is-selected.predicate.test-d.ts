import type { HookContext } from '@feathersjs/feathers'
import type { MemoryService } from '@feathersjs/memory'
import { isSelected } from './is-selected.predicate.js'

type Post = { id: number; title: string; author: { name: string } }
type PostsContext = HookContext<any, MemoryService<Post>>

describe('isSelected types', () => {
  it('takes any field without a type', () => {
    isSelected('anything')
    isSelected(['a', 'b.c'])
  })

  it('restricts the fields to those of the result', () => {
    isSelected<PostsContext>(['id', 'title', 'author.name'])

    // @ts-expect-error not a field of Post
    isSelected<PostsContext>('name')
  })
})
