import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import { expectNoSideEffects, runHook } from '../../testing/index.js'
import { findAll } from '../../utils/find-all/find-all.util.js'
import { denormalize } from './denormalize.hook.js'
import type { DenormalizeOptions } from './denormalize.hook.js'

type User = { id: number; name: string; address?: { city: string } }
type Post = {
  id: number
  title: string
  authorId: number | null
  authorName?: string | null
  authorCity?: string | null
}

const registrations = ['before and after', 'around'] as const

const setup = async (
  registration: (typeof registrations)[number] = 'around',
  options?: Partial<DenormalizeOptions>,
) => {
  const app = feathers<{
    users: MemoryService<User>
    posts: MemoryService<Post>
  }>()
  app.use('users', new MemoryService<User>({ startId: 1, multi: true }))
  app.use('posts', new MemoryService<Post>({ startId: 1, multi: true }))
  const users = app.service('users')
  const posts = app.service('posts')
  await users.create([
    { name: 'Anna', address: { city: 'Köln' } },
    { name: 'Ben', address: { city: 'Bonn' } },
  ])

  const author = denormalize({
    source: 'users',
    target: 'posts',
    key: 'authorId',
    fields: { authorName: 'name', authorCity: 'address.city' },
    ...options,
  })
  const register = (
    service: typeof users | typeof posts,
    hook: any,
    methods: string[],
  ) => {
    const map = Object.fromEntries(methods.map((method) => [method, [hook]]))
    service.hooks(
      registration === 'around' ? { around: map } : { before: map, after: map },
    )
  }
  register(posts, author.target, ['create', 'update', 'patch'])
  register(users, author.source, ['update', 'patch'])

  const usersFind = vi.spyOn(users, 'find')
  const postsPatch = vi.spyOn(posts, 'patch')
  const all = () => findAll(app, 'posts', { query: { $sort: { id: 1 } } })
  return { app, users, posts, usersFind, postsPatch, all }
}

describe('denormalize', () => {
  describe.each(registrations)('registered %s', (registration) => {
    describe('target', () => {
      it('fills the fields from the source item on create', async () => {
        const { posts } = await setup(registration)

        expect(await posts.create({ title: 'a', authorId: 1 })).toMatchObject({
          authorName: 'Anna',
          authorCity: 'Köln',
        })
      })

      it('reads the source items of a multi create with one query', async () => {
        const { posts, usersFind } = await setup(registration)

        const created = await posts.create([
          { title: 'a', authorId: 1 },
          { title: 'b', authorId: 2 },
          { title: 'c', authorId: 1 },
        ])

        expect(created.map((post) => post.authorName)).toEqual([
          'Anna',
          'Ben',
          'Anna',
        ])
        expect(usersFind).toHaveBeenCalledOnce()
        expect(usersFind).toHaveBeenCalledWith({
          query: { id: { $in: [1, 2] }, $select: ['id', 'name', 'address'] },
          paginate: false,
        })
      })

      it('sets null without a source item', async () => {
        const { posts } = await setup(registration)

        expect(
          await posts.create([
            { title: 'a', authorId: null },
            { title: 'b', authorId: 99 },
          ]),
        ).toMatchObject([
          { authorName: null, authorCity: null },
          { authorName: null, authorCity: null },
        ])
      })

      it('overwrites a value the caller sends', async () => {
        const { posts } = await setup(registration)

        expect(
          await posts.create({ title: 'a', authorId: 1, authorName: 'fake' }),
        ).toMatchObject({ authorName: 'Anna' })
      })

      it('refills the fields when a patch changes the key', async () => {
        const { posts, usersFind } = await setup(registration)
        await posts.create({ title: 'a', authorId: 1 })
        usersFind.mockClear()

        expect(await posts.patch(1, { authorId: 2 })).toMatchObject({
          authorName: 'Ben',
        })

        // a patch without the key reads no source item
        await posts.patch(1, { title: 'b' })
        expect(usersFind).toHaveBeenCalledOnce()
      })
    })

    describe('source', () => {
      it('copies a changed field to the target items', async () => {
        const { posts, users, all } = await setup(registration)
        await posts.create([
          { title: 'a', authorId: 1 },
          { title: 'b', authorId: 1 },
          { title: 'c', authorId: 2 },
        ])
        const events: Post[] = []
        posts.on('patched', (post: Post) => events.push(post))

        await users.patch(1, { name: 'Anne' })

        expect((await all()).map((post) => post.authorName)).toEqual([
          'Anne',
          'Anne',
          'Ben',
        ])
        // the patches of the targets send their events
        expect(events.map((post) => post.id)).toEqual([1, 2])
      })

      it('copies only the fields that change', async () => {
        const { posts, users, postsPatch } = await setup(registration)
        await posts.create({ title: 'a', authorId: 1 })
        postsPatch.mockClear()

        await users.patch(1, { address: { city: 'Bonn' }, name: 'Anna' })

        expect(postsPatch.mock.calls[0]![1]).toEqual({ authorCity: 'Bonn' })
      })

      it('leaves the targets alone for a patch of other fields', async () => {
        const { posts, users, postsPatch } = await setup(registration)
        await posts.create({ title: 'a', authorId: 1 })
        postsPatch.mockClear()

        await users.patch(1, { name: 'Anna' })
        await users.patch(1, { id: 1 } as any)

        expect(postsPatch).not.toHaveBeenCalled()
      })

      it('copies the fields of every source item of a multi patch', async () => {
        const { posts, users, all } = await setup(registration)
        await posts.create([
          { title: 'a', authorId: 1 },
          { title: 'b', authorId: 2 },
        ])

        await users.patch(null, { address: { city: 'Essen' } }, { query: {} })

        expect((await all()).map((post) => post.authorCity)).toEqual([
          'Essen',
          'Essen',
        ])
      })
    })
  })

  it('works with several sources on one target, side by side', async () => {
    const app = feathers()
    app.use('users', new MemoryService({ startId: 1, multi: true }))
    app.use('categories', new MemoryService({ startId: 1, multi: true }))
    app.use('posts', new MemoryService({ startId: 1, multi: true }))
    await app.service('users').create([{ name: 'Anna' }, { name: 'Ben' }])
    await app.service('categories').create({ name: 'News' })

    // two relations, and one source through two keys
    const author = denormalize({
      source: 'users',
      target: 'posts',
      key: 'authorId',
      fields: { authorName: 'name' },
    })
    const reviewer = denormalize({
      source: 'users',
      target: 'posts',
      key: 'reviewerId',
      fields: { reviewerName: 'name' },
    })
    const category = denormalize({
      source: 'categories',
      target: 'posts',
      key: 'categoryId',
      fields: { categoryName: 'name' },
    })
    const targets = [author.target, reviewer.target, category.target]
    app.service('posts').hooks({
      around: { create: targets, update: targets, patch: targets },
    })
    app.service('users').hooks({
      around: { patch: [author.source, reviewer.source] },
    })
    app.service('categories').hooks({ around: { patch: [category.source] } })

    const post = await app
      .service('posts')
      .create({ title: 'a', authorId: 1, reviewerId: 2, categoryId: 1 })
    expect(post).toMatchObject({
      authorName: 'Anna',
      reviewerName: 'Ben',
      categoryName: 'News',
    })

    // each source updates only its own fields
    await app.service('users').patch(2, { name: 'Bernd' })
    await app.service('categories').patch(1, { name: 'Sport' })

    expect(await app.service('posts').get(post.id)).toMatchObject({
      authorName: 'Anna',
      reviewerName: 'Bernd',
      categoryName: 'Sport',
    })
  })

  it('copies a field even if the $select of the call leaves it out', async () => {
    const { posts, users, all } = await setup()
    await posts.create({ title: 'a', authorId: 1 })

    await users.patch(1, { name: 'Anne' }, { query: { $select: ['id'] } })

    expect((await all())[0]).toMatchObject({ authorName: 'Anne' })
  })

  it('copies in the background without blocking', async () => {
    const onError = vi.fn()
    const { posts, users, all } = await setup('around', {
      blocking: false,
      onError,
    })
    await posts.create({ title: 'a', authorId: 1 })

    await users.patch(1, { name: 'Anne' })

    await vi.waitFor(async () =>
      expect((await all())[0]).toMatchObject({ authorName: 'Anne' }),
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('throws for the source hook on other methods', async () => {
    const { source } = denormalize({
      source: 'users',
      target: 'posts',
      key: 'authorId',
      fields: { authorName: 'name' },
    })

    await expect(
      runHook(source, { type: 'before', method: 'create', data: {} }),
    ).rejects.toThrow("The 'denormalize' hook has invalid context")
  })

  it('does not mutate params or data', async () => {
    const { app } = await setup()

    await expectNoSideEffects(
      { params: { query: { $select: ['id'] } }, data: { name: 'Anne' } },
      async ({ params, data }) => {
        await app.service('users').patch(1, data, params as any)
        return null
      },
    )
  })
})
