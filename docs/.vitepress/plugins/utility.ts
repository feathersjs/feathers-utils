import {
  type Utility,
  type UtilityOption,
  type UtilityOptionGroup,
} from '../utilities.js'
import { kebabCase } from '../kebab-case.js'

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

/**
 * Where a page wants the generated `## Options` section to land in its body.
 */
const OPTIONS_MARKER = '<!-- options -->'

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

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const exampleBlocks = (option: UtilityOption, utilities: Utility[]) =>
  (option.examples ?? []).map((example, index, all) => {
    const label = all.length > 1 ? `Example ${index + 1}` : 'Example'
    return `::: details ${label}\n${resolveLinks(example, utilities)}\n:::`
  })

/**
 * One option: a signature line (name · type · default, `required` when the
 * member has no `?`) with the description and any `@example` below it, so a
 * long description gets the full column width instead of a table cell.
 *
 * The blank lines matter — they end each HTML block, which is what lets
 * markdown-it render the description and the fenced examples as markdown
 * inside the wrapper.
 */
const optionBlock = (option: UtilityOption, utilities: Utility[]) => {
  const signature = [
    `<span class="option-name">${escapeHtml(option.name)}</span>`,
    `<span class="option-type">${escapeHtml(option.type)}</span>`,
    option.default
      ? `<span class="option-default"><span class="option-label">default</span>${escapeHtml(option.default)}</span>`
      : '',
    option.optional ? '' : '<span class="option-required">required</span>',
  ].join('')

  const body = [
    resolveLinks(option.description, utilities),
    ...exampleBlocks(option, utilities),
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    `<div class="option" id="option-${kebabCase(option.name)}">`,
    `<div class="option-signature">${signature}</div>`,
    ...(body ? ['<div class="option-body">', body, '</div>'] : []),
    '</div>',
  ].join('\n\n')
}

/**
 * The `## Options` section, generated from the type(s) named in the page's
 * `options` frontmatter — so what is documented can never drift from the type.
 *
 * A page that documents more than one type gets a sub-heading per type, which
 * also gives each one its own anchor in the outline.
 */
const optionsSection = (
  groups: UtilityOptionGroup[],
  utilities: Utility[],
  isSearch: boolean,
) => {
  // the wrapper markup carries no text of its own, and the index is after prose
  const render = (option: UtilityOption) =>
    isSearch
      ? [
          [
            `\`${option.name}\``,
            `\`${option.type}\``,
            option.default ? `default \`${option.default}\`` : '',
            option.optional ? '' : 'required',
          ]
            .filter(Boolean)
            .join(' · '),
          resolveLinks(option.description, utilities),
          ...(option.examples ?? []).map((example) =>
            resolveLinks(example, utilities),
          ),
        ]
          .filter(Boolean)
          .join('\n\n')
      : optionBlock(option, utilities)

  const blocks = groups.flatMap((group) => [
    ...(groups.length > 1 ? [`### \`${group.type}\``] : []),
    ...(isSearch
      ? group.members.map(render)
      : ['<div class="options">', ...group.members.map(render), '</div>']),
  ])

  return ['## Options', ...blocks].join('\n\n')
}

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

  const optionsMarkdown = utility.options?.length
    ? optionsSection(utility.options, utilities, isSearch)
    : undefined

  // a page can place the generated table itself with an `<!-- options -->`
  // marker in its body; without one the table follows the examples
  let content = isSearch ? stripTwoslash(utility.content) : utility.content

  if (optionsMarkdown && content.includes(OPTIONS_MARKER)) {
    content = content.replace(OPTIONS_MARKER, optionsMarkdown)
  } else {
    content = content.replace(OPTIONS_MARKER, '')
    if (optionsMarkdown) {
      code.push(optionsMarkdown)
    }
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

  code.push(content)

  return code.join('\n\n')
}
