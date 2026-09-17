import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DefaultTheme } from 'vitepress'
import { discoverUtilities, type Utility } from './utilities.js'
import {
  utilityTagGroups,
  utilityTagPageContent,
  type UtilityTagDefinition,
} from './tags.js'
import utilityMarkdown from './plugins/utility.js'

/**
 * VitePress' local search indexes a page by reading its markdown file straight
 * from disk — it sees neither the dynamic routes under `docs/<category>/[slug].md`
 * (there is no `docs/utils/gate-params.md` to read) nor the `MarkdownTransform`
 * plugin that turns a utility's JSDoc into the page body. Left alone, every
 * utility and tag page is indexed as the empty string and the search box only
 * ever finds the handful of hand-written pages.
 *
 * `_render` fills that gap: for a generated page it rebuilds the markdown from
 * the same source the page itself is built from, and hands it to the indexer.
 */

const srcDir = fileURLToPath(new URL('..', import.meta.url))

// `discoverUtilities()` rebuilds a TypeScript program and re-measures every
// export, and the indexer renders one page at a time — so the whole index
// shares a single run of it.
let discovery: Promise<Utility[]> | undefined
const getUtilities = () => (discovery ??= discoverUtilities())

const utilityTags = utilityTagGroups.flatMap(
  (group) => group.tags,
) as readonly UtilityTagDefinition[]

/** `docs/utils/gate-params.md` (absolute, any platform) → `utils/gate-params.md`. */
const toRelativePath = (file: string) =>
  path.relative(srcDir, path.resolve(file)).split(path.sep).join('/')

const findUtility = async (relativePath: string) =>
  (await getUtilities()).find((x) => x.pathMd === `/${relativePath}`)

const findTag = (relativePath: string) => {
  const match = /^tags\/(.+)\.md$/.exec(relativePath)
  return match ? utilityTags.find((tag) => tag.name === match[1]) : undefined
}

/**
 * The markdown to index for `relativePath`, or `undefined` when the page is a
 * plain file that the indexer has already read into `src`.
 */
const generatedMarkdown = async (relativePath: string) => {
  const utility = await findUtility(relativePath)
  if (utility) {
    return utilityMarkdown(utility, await getUtilities(), { target: 'search' })
  }

  const tag = findTag(relativePath)
  return tag ? utilityTagPageContent(tag) : undefined
}

type SplitIntoSections = NonNullable<
  NonNullable<
    DefaultTheme.LocalSearchOptions['miniSearch']
  >['_splitIntoSections']
>

/**
 * A generated page is indexed as one document instead of one per heading. The
 * utility *is* the unit a reader is looking for, and the result list is capped
 * at 16 entries — three headings of the same utility would crowd out two other
 * utilities. The long hand-written pages (the migration guides) keep the
 * default per-heading split, where jumping to the right section is the point.
 *
 * Returning `undefined` is what falls back to that default splitter; the
 * published type does not express it, hence the cast.
 */
const splitIntoSections = (async (file: string, html: string) => {
  const relativePath = toRelativePath(file)
  const utility = await findUtility(relativePath)
  const title = utility?.title ?? findTag(relativePath)?.name

  if (!title) return undefined

  return [
    {
      // The detailed view builds its excerpt by walking the real page's
      // headings and keying what follows each one by its anchor — a section
      // without one gets no excerpt at all. Taken off the rendered `<h1>`
      // rather than slugified here, so it cannot drift from the page.
      anchor: /<h1[^>]*>.*?href="#([^"]+)"/s.exec(html)?.[1] ?? '',
      titles: [title],
      text: html.replace(/<[^>]*>/g, ''),
    },
  ]
}) as SplitIntoSections

export const searchOptions: DefaultTheme.LocalSearchOptions = {
  // Show each hit with the matching prose underneath, not just the name. The
  // names alone read as a list of near-synonyms — `setField`, `setData`,
  // `setQueryDefaults` — and say nothing about which one to pick.
  detailedView: true,

  miniSearch: {
    options: {
      /**
       * Every page here is named in camelCase, so the default tokenizer —
       * split on whitespace and punctuation — indexes `stringifyParams` as one
       * term that a search for "params" never reaches (prefix matching only
       * catches the *start* of a term). Indexing the parts as well makes the
       * words inside a name searchable.
       *
       * Serialized into the client bundle by VitePress, so it has to stay
       * self-contained — no imports, no closure.
       */
      tokenize: (text: string) => {
        const tokens: string[] = []

        for (const word of text.split(/[\n\r\p{Z}\p{P}]+/u)) {
          if (!word) continue

          tokens.push(word)

          const parts = word.split(
            /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/,
          )
          if (parts.length > 1) tokens.push(...parts)
        }

        return tokens
      },
    },

    _splitIntoSections: splitIntoSections,
  },

  async _render(src, env, md) {
    const generated = await generatedMarkdown(env.relativePath)

    if (generated != null) {
      return md.renderAsync(generated, env)
    }

    const html = await md.renderAsync(src, env)
    return env.frontmatter?.search === false ? '' : html
  },
}
