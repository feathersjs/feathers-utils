import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { findAll } from '../../utils/find-all/find-all.util.js'
import { counterCache } from './counter-cache.hook.js'
import type { CounterCacheOptions } from './counter-cache.hook.js'

type Post = { id: number; title: string; commentCount: number }
type Comment = {
  id: number
  postId: number | null
  text: string
  deletedAt: number | null
}

const registrations = ['before and after', 'around'] as const

const setup = async (
  registration: (typeof registrations)[number] = 'around',
  options?: Partial<CounterCacheOptions>,
) => {
  const app = feathers<{
    posts: MemoryService<Post>
    comments: MemoryService<Comment>
  }>()
  app.use('posts', new MemoryService<Post>({ startId: 1, multi: true }))
  app.use('comments', new MemoryService<Comment>({ startId: 1, multi: true }))
  const posts = app.service('posts')
  const comments = app.service('comments')
  await posts.create([
    { title: 'a', commentCount: 0 },
    { title: 'b', commentCount: 0 },
  ])

  const hook = counterCache({
    service: 'posts',
    key: 'postId',
    field: 'commentCount',
    where: { deletedAt: null },
    ...options,
  })
  const methods = {
    create: [hook],
    update: [hook],
    patch: [hook],
    remove: [hook],
  }
  comments.hooks(
    registration === 'around'
      ? { around: methods }
      : { before: methods, after: methods },
  )

  const counts = async () =>
    (await findAll(app, 'posts', { query: { $sort: { id: 1 } } })).map(
      (post) => post.commentCount,
    )
  const postsPatch = vi.spyOn(posts, 'patch')
  return { app, posts, comments, counts, postsPatch }
}

describe('counterCache', () => {
  describe.each(registrations)('registered %s', (registration) => {
    it('counts the items a create adds', async () => {
      const { comments, counts } = await setup(registration)

      await comments.create({ postId: 1, text: 'x', deletedAt: null })
      await comments.create([
        { postId: 1, text: 'y', deletedAt: null },
        { postId: 2, text: 'z', deletedAt: null },
      ])

      expect(await counts()).toEqual([2, 1])
    })

    it('counts the items a remove takes away', async () => {
      const { comments, counts } = await setup(registration)
      await comments.create([
        { postId: 1, text: 'x', deletedAt: null },
        { postId: 1, text: 'y', deletedAt: null },
      ])

      await comments.remove(1)

      expect(await counts()).toEqual([1, 0])
    })

    it('updates both parents when a patch moves an item', async () => {
      const { comments, counts } = await setup(registration)
      await comments.create({ postId: 1, text: 'x', deletedAt: null })

      await comments.patch(1, { postId: 2 })

      expect(await counts()).toEqual([0, 1])
    })

    it('counts only the items that match where', async () => {
      const { comments, counts } = await setup(registration)
      await comments.create([
        { postId: 1, text: 'x', deletedAt: null },
        { postId: 1, text: 'y', deletedAt: null },
      ])

      // a patch of a field of where updates the count
      await comments.patch(1, { deletedAt: 5 })

      expect(await counts()).toEqual([1, 0])
    })

    it('leaves the counts alone for a patch of other fields', async () => {
      const { comments, postsPatch } = await setup(registration)
      await comments.create({ postId: 1, text: 'x', deletedAt: null })
      postsPatch.mockClear()

      await comments.patch(1, { text: 'y' })

      expect(postsPatch).not.toHaveBeenCalled()
    })
  })

  it('patches parents with an equal count with a single call', async () => {
    const { comments, postsPatch } = await setup()

    await comments.create([
      { postId: 1, text: 'x', deletedAt: null },
      { postId: 2, text: 'y', deletedAt: null },
    ])

    expect(postsPatch).toHaveBeenCalledOnce()
    expect(postsPatch.mock.calls[0]![0]).toBeNull()
  })

  it('finds the key even if the $select of the call leaves it out', async () => {
    const { comments, counts } = await setup()
    await comments.create({ postId: 1, text: 'x', deletedAt: null })

    await comments.patch(1, { postId: 2 }, { query: { $select: ['text'] } })

    expect(await counts()).toEqual([0, 1])
  })

  it('updates the counts in the background without blocking', async () => {
    const onError = vi.fn()
    const { comments, counts } = await setup('around', {
      blocking: false,
      onError,
    })

    await comments.create({ postId: 1, text: 'x', deletedAt: null })
    await vi.waitFor(async () => expect(await counts()).toEqual([1, 0]))
    expect(onError).not.toHaveBeenCalled()
  })

  it('passes an error in the background to onError', async () => {
    const onError = vi.fn()
    const { comments } = await setup('around', {
      service: 'missing',
      blocking: false,
      onError,
    })

    await comments.create({ postId: 1, text: 'x', deletedAt: null })
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
  })

  it('throws in error hooks, and for other methods', async () => {
    const hook = counterCache({ service: 'posts', key: 'postId', field: 'n' })

    await expect(
      runHook(hook, { type: 'before', method: 'find' }),
    ).rejects.toThrow("The 'counterCache' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const { app } = await setup()

    await expectNoSideEffects(
      {
        params: { query: { $select: ['text'] } },
        data: { postId: 2 },
      },
      async ({ params, data }) => {
        const [comment] = await app
          .service('comments')
          .create([{ postId: 1, text: 'x', deletedAt: null }])
        const patched = await app
          .service('comments')
          .patch(comment!.id, data, params as any)
        return patched.text
      },
    )
  })
})
