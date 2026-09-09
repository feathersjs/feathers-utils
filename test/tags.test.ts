import fs from 'node:fs/promises'
import matter from '@11ty/gray-matter'
import { glob } from 'tinyglobby'
import {
  isUtilityTag,
  utilityTagGroups,
  utilityTags,
} from '../docs/.vitepress/tags.js'

type Page = {
  file: string
  title: string
  tags: unknown
}

const pages: Page[] = []

beforeAll(async () => {
  const files = await glob('src/**/*.md', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  })

  for (const file of files) {
    const { data } = matter(await fs.readFile(file, 'utf-8'))

    // pages without a title/category are helper docs, not utilities — they are
    // skipped by `discoverUtilities` too
    if (!data.title || !data.category) {
      continue
    }

    pages.push({ file, title: data.title, tags: data.tags })
  }

  pages.sort((a, b) => a.file.localeCompare(b.file))
})

describe('tags', function () {
  it('discovers the documented utilities', function () {
    expect(pages.length).toBeGreaterThan(80)
  })

  it('has a unique, non-empty vocabulary', function () {
    expect(utilityTags.length).toBe(new Set(utilityTags).size)
    expect(utilityTags.length).toBeGreaterThan(0)
  })

  it('uses lowercase kebab-case tag names', function () {
    for (const tag of utilityTags) {
      expect(tag, tag).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })

  it('documents every tag', function () {
    for (const group of utilityTagGroups) {
      expect(group.label, group.label).toBeTruthy()
      expect(group.description, group.label).toBeTruthy()

      for (const tag of group.tags) {
        expect(tag.description, tag.name).toBeTruthy()
      }
    }
  })

  it('only uses tags from the vocabulary', function () {
    const offenders = pages.flatMap(({ file, tags }) =>
      (Array.isArray(tags) ? tags : [])
        .filter((tag) => !isUtilityTag(tag))
        .map((tag) => `${file}: ${JSON.stringify(tag)}`),
    )

    expect(offenders).toEqual([])
  })

  it('has no vocabulary entry that no page uses', function () {
    const used = new Set(
      pages.flatMap(({ tags }) => (Array.isArray(tags) ? tags : [])),
    )

    expect(utilityTags.filter((tag) => !used.has(tag))).toEqual([])
  })

  it('lists tags as an array of unique values', function () {
    for (const { file, tags } of pages) {
      if (tags === undefined) {
        continue
      }

      expect(Array.isArray(tags), file).toBe(true)
      const list = tags as string[]
      expect(list.length, file).toBeGreaterThan(0)
      expect(new Set(list).size, file).toBe(list.length)
    }
  })

  it('lists tags in vocabulary order, so diffs stay stable', function () {
    for (const { file, tags } of pages) {
      if (!Array.isArray(tags)) {
        continue
      }

      const sorted = [...tags].sort(
        (a, b) => utilityTags.indexOf(a) - utilityTags.indexOf(b),
      )

      expect(tags, file).toEqual(sorted)
    }
  })
})
