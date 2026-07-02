import { type Utility } from '../utilities'
import kebabCase from 'lodash/kebabCase.js'

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

const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(2)} kB`

export default (utility: Utility, utilities: Utility[]) => {
  const code = [`# ${utility.title}`]

  // Meta grid (VueUse-style): fixed label column + value column. Rendered as a
  // raw HTML block, so values use HTML (<a>/<code>) — markdown isn't parsed
  // inside HTML blocks; only Vue components like <Chip> survive.
  ;(() => {
    const rows: [label: string, value: string][] = []

    rows.push([
      'Category',
      `<Chip label="${utility.category}" class="mr-2" /> <a href="${utility.sourceUrl}" target="_blank" rel="noreferrer">Source Code</a> | <a href="${utility.docsUrl}" target="_blank" rel="noreferrer">Documentation</a>`,
    ])

    if (utility.bundleSize) {
      rows.push([
        'Export size',
        `min ${formatBytes(utility.bundleSize.minified)} · gzip ${formatBytes(utility.bundleSize.gzip)}`,
      ])
    }

    if (utility.aliases?.length) {
      rows.push([
        'Aliases',
        utility.aliases.map((a) => `<code>${a}</code>`).join(', '),
      ])
    }

    const see: string[] = utility.frontmatter?.see ?? []
    if (see.length > 0) {
      rows.push([
        'See also',
        see
          .map((x) => {
            const found = utilities.find((u) => u.name === x)
            const href = found
              ? found.path
              : `/${x.split('/').map(kebabCase).join('/')}${x.includes('/') ? '.html' : '/'}`
            return `<a href="${href}"><code>${x}</code></a>`
          })
          .join(' '),
      ])
    }

    const grid = [
      `<div class="grid grid-cols-[100px_auto] gap-x-4 gap-y-2 items-center mt-4 mb-8 text-sm">`,
      ...rows.flatMap(([label, value]) => [
        `<div class="opacity-60">${label}</div>`,
        `<div>${value}</div>`,
      ]),
      `</div>`,
    ].join('\n')

    code.push(grid)
  })()

  code.push(`${resolveLinks(utility.description, utilities)}

\`\`\`ts twoslash
  import { ${utility.name} } from 'feathers-utils/${utility.category}';
\`\`\` `)

  if (utility.examples?.length) {
    code.push(`
## ${utility.examples.length > 1 ? 'Examples' : 'Example'}

${utility.examples.map((e) => resolveLinks(e, utilities)).join('\n\n')}
    `)
  }

  if (utility.category === 'transformers') {
    code.push(`
## Hooks for transformers

<HooksTable :filter="(hook) => hook.transformers" />

## Utilities for transformers

<UtilsTable :filter="(util) => util.transformers" />
    `)
  }

  if (utility.category === 'predicates') {
    code.push(`
## Hooks for predicates

<HooksTable :filter="(hook) => hook.predicates" />
    `)
  }

  if (utility.dts) {
    code.push(`## Type declaration
<details>
<summary class="opacity-50 italic cursor-pointer select-none">Show Type Declarations</summary>

\`\`\`ts
${utility.dts}
\`\`\`

</details>
`)
  }

  if (utility.args?.length) {
    code.push(`
<ArgsTable :args='${JSON.stringify(utility.args)}' />
    `)
  }

  if (utility.hook) {
    code.push(`
<HookTable :type="${arr(utility.hook.type)}" :method="${arr(utility.hook.method)}" :multi="${utility.hook.multi}" />
    `)
  }

  code.push(utility.content)

  return code.join('\n\n')
}
