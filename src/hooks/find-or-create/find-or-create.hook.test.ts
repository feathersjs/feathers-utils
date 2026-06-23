import { expect, expectTypeOf } from 'vitest'
import { feathers } from '@feathersjs/feathers'
import { MemoryService } from '@feathersjs/memory'
import type { AroundHookFunction, HookContext } from '@feathersjs/feathers'
import { findOrCreate } from './find-or-create.hook.js'

const mockApp = () => {
  const app = feathers()

  app.use('tags', new MemoryService({ startId: 1, multi: true }))

  const tagsService = app.service('tags')

  return { app, tagsService }
}

type Tag = {
  id: number
  name: string
  slug?: string
  archived?: boolean
}

const mockAppStronglyTyped = () => {
  const app = feathers<{ tags: MemoryService<Tag> }>()

  app.use('tags', new MemoryService<Tag>({ startId: 1, multi: true }))

  const tagsService = app.service('tags')

  return { app, tagsService }
}

describe('hook - findOrCreate (type tests)', function () {
  it('errors on wrong service name', function () {
    const { app } = mockAppStronglyTyped()

    app.service('tags').hooks({
      before: {
        create: [
          findOrCreate({
            // @ts-expect-error - 'nonexistent' is not a valid service name
            service: 'nonexistent',
            uniqueBy: 'name',
          }),
        ],
      },
    })
  })

  it('errors when uniqueBy is not a key of the data', function () {
    const { app } = mockAppStronglyTyped()

    app.service('tags').hooks({
      before: {
        create: [
          findOrCreate({
            service: 'tags',
            // @ts-expect-error - 'nonExistentProp' is not a key of Tag
            uniqueBy: 'nonExistentProp',
          }),
        ],
      },
    })
  })

  it('is type-compatible with AroundHookFunction', () => {
    type Services = { tags: MemoryService<Tag> }
    type App = ReturnType<typeof feathers<Services>>
    type Ctx = HookContext<App, MemoryService<Tag>>

    expectTypeOf(
      findOrCreate<Ctx>({ service: 'tags', uniqueBy: 'name' }),
    ).toExtend<AroundHookFunction<App, MemoryService<Tag>>>()
  })
})

describe('hook - findOrCreate', function () {
  it('returns the existing record when exactly one matches', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      before: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const first = await tagsService.create({ name: 'foo' })
    const second = await tagsService.create({ name: 'foo' })

    expect(second).toStrictEqual(first)

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(1)
  })

  it('creates a new record when nothing matches', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      before: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const result = await tagsService.create({ name: 'bar' })

    expect(result).toMatchObject({ name: 'bar' })

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(1)
  })

  it("creates a new record on multiple matches by default ('create')", async function () {
    const { app, tagsService } = mockApp()

    // seed duplicates before registering the hook
    await tagsService.create([{ name: 'dup' }, { name: 'dup' }])

    app.service('tags').hooks({
      before: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const result = await tagsService.create({ name: 'dup' })

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(3)
    expect(result).toMatchObject({ id: 3, name: 'dup' })
  })

  it("throws on multiple matches when onMultiple is 'throw'", async function () {
    const { app, tagsService } = mockApp()

    await tagsService.create([{ name: 'dup' }, { name: 'dup' }])

    app.service('tags').hooks({
      before: {
        create: [
          findOrCreate({
            service: 'tags',
            uniqueBy: 'name',
            onMultiple: 'throw',
          }),
        ],
      },
    })

    await expect(tagsService.create({ name: 'dup' })).rejects.toThrow(
      /findOrCreate: found 2 records/,
    )

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(2)
  })

  it("returns the first match when onMultiple is 'first'", async function () {
    const { app, tagsService } = mockApp()

    const [firstDup] = await tagsService.create([
      { name: 'dup' },
      { name: 'dup' },
    ])

    app.service('tags').hooks({
      before: {
        create: [
          findOrCreate({
            service: 'tags',
            uniqueBy: 'name',
            onMultiple: 'first',
          }),
        ],
      },
    })

    const result = await tagsService.create({ name: 'dup' })

    expect(result).toStrictEqual(firstDup)

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(2)
  })

  it('skips uniqueBy paths whose value is undefined', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      before: {
        create: [findOrCreate({ service: 'tags', uniqueBy: ['name', 'slug'] })],
      },
    })

    // no `slug` in either call -> the query is built from `name` only
    const first = await tagsService.create({ name: 'x' })
    const second = await tagsService.create({ name: 'x' })

    expect(second).toStrictEqual(first)

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(1)
  })

  it('merges the query returned by params()', async function () {
    const { app, tagsService } = mockApp()

    // two records share a name; only one is not archived
    await tagsService.create([
      { name: 'p', archived: true },
      { name: 'p', archived: false },
    ])

    app.service('tags').hooks({
      before: {
        create: [
          findOrCreate({
            service: 'tags',
            uniqueBy: 'name',
            params: () => ({ query: { archived: false } }),
          }),
        ],
      },
    })

    const result = await tagsService.create({ name: 'p', archived: false })

    // narrowed to the single archived:false record, so it short-circuits
    expect(result).toMatchObject({ id: 2, name: 'p', archived: false })

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(2)
  })

  it('falls through to a normal create for array data', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      before: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const result = await tagsService.create([{ name: 'a' }, { name: 'b' }])

    expect(result).toHaveLength(2)

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(2)
  })

  it('short-circuits in an around hook without running the create', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      around: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const first = await tagsService.create({ name: 'q' })
    const second = await tagsService.create({ name: 'q' })

    expect(second).toStrictEqual(first)

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(1)
  })

  it('proceeds to create in an around hook when nothing matches', async function () {
    const { app, tagsService } = mockApp()

    app.service('tags').hooks({
      around: {
        create: [findOrCreate({ service: 'tags', uniqueBy: 'name' })],
      },
    })

    const result = await tagsService.create({ name: 'fresh' })

    expect(result).toMatchObject({ name: 'fresh' })

    const tags = await tagsService.find({ query: {} })
    expect(tags).toHaveLength(1)
  })

  it('throws on an invalid context (wrong type/method)', async function () {
    const { app, tagsService } = mockApp()

    const context = {
      app,
      service: tagsService,
      path: 'tags',
      type: 'after',
      method: 'create',
      data: { name: 'foo' },
    } as unknown as HookContext

    await expect(
      findOrCreate({ service: 'tags', uniqueBy: 'name' })(context),
    ).rejects.toThrow(/findOrCreate/)
  })
})
