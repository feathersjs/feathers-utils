import { type Utility } from '../utilities.js'
import kebabCase from 'lodash/kebabCase.js'

/**
 * What the generated markdown is for.
 *
 * - `page` — the rendered doc page: meta grid, Vue component tables, twoslash.
 * - `search` — the same prose, reduced to what belongs in the search index.
 *   Component tables carry no text of their own, the meta grid would index
 *   labels like "Source Code" on every page, and twoslash would type-check ~100
 *   pages just to build an index. Headings are kept verbatim, so a hit still
 *   links to the anchor it was found under.
 */
export type UtilityMarkdownTarget = 'page' | 'search'

export type UtilityMarkdownOptions = {
  target?: UtilityMarkdownTarget
}

const arr = (value: any[]) => {
  if (!value || !value.length) return '[]'
  const val = value
    .map((x) => {
      if (typeof x === 'string') return `'${x}'`
      if (typeof x === 'number') return x.toString()
      return JSON.stringify(x)
    })
    .join(', ')

  return `[${val}]`
}

// Resolve JSDoc inline `{@link target}` / `{@link target label}` tags into
// markdown links (to a matching utility) or inline code as a fallback.
const resolveLinks = (text: string, utilities: Utility[]) =>
  text.replace(
    /\{@link\s+([^\s|}]+)(?:\s*\|?\s*([^}]+))?\}/g,
    (_match, target: string, label?: string) => {
      const text = (label ?? target).trim()
      const found = utilities.find((u) => u.name === target)
      return found ? `[\`${text}\`](${found.path})` : `\`${text}\``
    },
  )

// twoslash type-checks the block it annotates — worth it on the page, pure cost
// when the output is thrown away and only the text is kept.
const stripTwoslash = (markdown: string) =>
  markdown.replace(/^(\s*```\S+)[^\S\n]+twoslash\b/gm, '$1')

export default (
  utility: Utility,
  utilities: Utility[],
  options: UtilityMarkdownOptions = {},
) => {
  const { target = 'page' } = options
  const isSearch = target === 'search'

  const code = [`# ${utility.title}`]

  if (isSearch) {
    // The facets a reader types into the search box instead of the page's
    // title — an alias, the category, a tag. Kept to one line so it stays out
    // of the way in the detailed view.
    code.push(
      [utility.category, ...utility.tags, ...(utility.aliases ?? [])].join(
        ' · ',
      ),
    )
  } else {
    const see: string[] = utility.frontmatter?.see ?? []

    const props: [name: string, value: string][] = [
      ['category', `"${utility.category}"`],
      ['source-url', `"${utility.sourceUrl}"`],
      ['docs-url', `"${utility.docsUrl}"`],
    ]

    if (utility.tags.length) {
      props.push([':tags', `'${JSON.stringify(utility.tags)}'`])
    }

    if (utility.bundleSize) {
      props.push([':size', `'${JSON.stringify(utility.bundleSize)}'`])
    }

    if (utility.aliases?.length) {
      props.push([':aliases', `'${JSON.stringify(utility.aliases)}'`])
    }

    if (see.length) {
      const links = see.map((x) => {
        const found = utilities.find((u) => u.name === x)
        const href = found
          ? found.path
          : `/${x.split('/').map(kebabCase).join('/')}${x.includes('/') ? '.html' : '/'}`
        return { label: x, href }
      })

      props.push([':see', `'${JSON.stringify(links)}'`])
    }

    // One line: markdown ends an HTML block at a blank line, and the tag has to
    // survive as a whole for Vue to compile it.
    code.push(
      `<UtilityMeta ${props.map(([name, value]) => `${name}=${value}`).join(' ')} />`,
    )
  }

  code.push(`${resolveLinks(utility.description, utilities)}

\`\`\`ts${isSearch ? '' : ' twoslash'}
  import { ${utility.name} } from 'feathers-utils/${utility.category}';
\`\`\` `)

  if (utility.examples?.length) {
    const examples = utility.examples.map((example) =>
      resolveLinks(example, utilities),
    )

    // several examples get numbered subheadings, so each one is addressable by
    // its own anchor — a single example is already addressable by the `##` one
    const body =
      examples.length > 1
        ? examples
            .map((example, index) => `### Example ${index + 1}\n\n${example}`)
            .join('\n\n')
        : examples[0]

    code.push(`
## ${examples.length > 1 ? 'Examples' : 'Example'}

${isSearch ? stripTwoslash(body) : body}
    `)
  }

  if (utility.category === 'transformers' && !isSearch) {
    code.push(`
## Hooks for transformers

<HooksTable :filter="(hook) => hook.transformers" />

## Utilities for transformers

<UtilsTable :filter="(util) => util.transformers" />
    `)
  }

  if (utility.category === 'predicates' && !isSearch) {
    code.push(`
## Hooks for predicates

<HooksTable :filter="(hook) => hook.predicates" />
    `)
  }

  if (utility.dts) {
    code.push(
      isSearch
        ? `## Type declaration

\`\`\`ts
${utility.dts}
\`\`\`
`
        : `## Type declaration
<details>
<summary class="opacity-50 italic cursor-pointer select-none">Show Type Declarations</summary>

\`\`\`ts
${utility.dts}
\`\`\`

</details>
`,
    )
  }

  if (utility.args?.length) {
    // `<ArgsTable>` renders from a prop, so its text is invisible to the
    // indexer — the search build gets the same rows as plain markdown.
    code.push(
      isSearch
        ? utility.args
            .map((arg) => `- \`${arg.name}\`: \`${arg.type}\``)
            .join('\n')
        : `
<ArgsTable :args='${JSON.stringify(utility.args)}' />
    `,
    )
  }

  if (utility.hook && !isSearch) {
    code.push(`
<HookTable :type="${arr(utility.hook.type)}" :method="${arr(utility.hook.method)}" :multi="${utility.hook.multi}" />
    `)
  }

  code.push(isSearch ? stripTwoslash(utility.content) : utility.content)

  return code.join('\n\n')
}
