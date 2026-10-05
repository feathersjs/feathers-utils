import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { count } from '../../utils/count/count.util.js'
import { findAll } from '../../utils/find-all/find-all.util.js'
import { aggregate } from './aggregate.hook.js'
import type { AggregateOptions } from './aggregate.hook.js'

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
  options?: Partial<AggregateOptions>,
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

  const compute = vi.fn((postIds: any[]) =>
    Promise.all(
      postIds.map(async (postId) => ({
        commentCount: await count(app, 'comments', {
          query: { postId, deletedAt: null },
        }),
      })),
    ),
  )
  const hook = aggregate({
    service: 'posts',
    key: 'postId',
    from: ['deletedAt'],
    compute,
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
  return { app, posts, comments, counts, compute, postsPatch }
}

describe('aggregate', () => {
  describe.each(registrations)('registered %s', (registration) => {
    it('updates the parents of the items a create adds', async () => {
      const { comments, counts } = await setup(registration)

      await comments.create({ postId: 1, text: 'x', deletedAt: null })
      await comments.create([
        { postId: 1, text: 'y', deletedAt: null },
        { postId: 2, text: 'z', deletedAt: null },
      ])

      expect(await counts()).toEqual([2, 1])
    })

    it('updates the parents of the items a remove takes away', async () => {
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

    it('updates the parents when a patch changes a from field', async () => {
      const { comments, counts } = await setup(registration)
      await comments.create([
        { postId: 1, text: 'x', deletedAt: null },
        { postId: 1, text: 'y', deletedAt: null },
      ])

      await comments.patch(1, { deletedAt: 5 })

      expect(await counts()).toEqual([1, 0])
    })

    it('leaves the parents alone for a patch of other fields', async () => {
      const { comments, compute, postsPatch } = await setup(registration)
      await comments.create({ postId: 1, text: 'x', deletedAt: null })
      compute.mockClear()
      postsPatch.mockClear()

      await comments.patch(1, { text: 'y' })

      expect(compute).not.toHaveBeenCalled()
      expect(postsPatch).not.toHaveBeenCalled()
    })
  })

  it('computes all touched parents at once', async () => {
    const { comments, compute } = await setup()
    await comments.create([
      { postId: 1, text: 'x', deletedAt: null },
      { postId: 1, text: 'y', deletedAt: null },
    ])
    compute.mockClear()

    await comments.patch(null, { postId: 2 }, { query: {} })

    expect(compute).toHaveBeenCalledOnce()
    expect(compute.mock.calls[0]![0]).toEqual([1, 2])
  })

  it('updates the parents on every patch without from', async () => {
    const { comments, compute } = await setup('around', { from: undefined })
    await comments.create({ postId: 1, text: 'x', deletedAt: null })
    compute.mockClear()

    await comments.patch(1, { text: 'y' })

    expect(compute).toHaveBeenCalledOnce()
  })

  it('updates the parents only for a change of key with from: []', async () => {
    const { comments, compute } = await setup('around', { from: [] })
    await comments.create({ postId: 1, text: 'x', deletedAt: null })
    compute.mockClear()

    await comments.patch(1, { deletedAt: 5 })
    expect(compute).not.toHaveBeenCalled()

    await comments.patch(1, { postId: 2 })
    expect(compute).toHaveBeenCalledOnce()
  })

  it('patches several fields, and parents with equal values with a single call', async () => {
    const { comments, posts, postsPatch } = await setup('around', {
      compute: (postIds) =>
        postIds.map(() => ({ commentCount: 1, title: 'busy' })),
    })

    await comments.create([
      { postId: 1, text: 'x', deletedAt: null },
      { postId: 2, text: 'y', deletedAt: null },
    ])

    expect(postsPatch).toHaveBeenCalledOnce()
    expect(postsPatch.mock.calls[0]![0]).toBeNull()
    expect(await posts.get(2)).toMatchObject({ commentCount: 1, title: 'busy' })
  })

  it('throws when compute does not return one value per parent', async () => {
    const { comments } = await setup('around', { compute: () => [] })

    await expect(
      comments.create({ postId: 1, text: 'x', deletedAt: null }),
    ).rejects.toThrow('compute returned 0 values for 1 parents')
  })

  it('finds the key even if the $select of the call leaves it out', async () => {
    const { comments, counts } = await setup()
    await comments.create({ postId: 1, text: 'x', deletedAt: null })

    await comments.patch(1, { postId: 2 }, { query: { $select: ['text'] } })

    expect(await counts()).toEqual([0, 1])
  })

  it('updates the parents in the background without blocking', async () => {
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

  it('throws for other methods', async () => {
    const hook = aggregate({
      service: 'posts',
      key: 'postId',
      compute: () => [],
    })

    await expect(
      runHook(hook, { type: 'before', method: 'find' }),
    ).rejects.toThrow("The 'aggregate' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const { app } = await setup()

    await expectNoSideEffects(
      { params: { query: { $select: ['text'] } }, data: { postId: 2 } },
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
