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

export default (utility: Utility) => {
  const code = [
    `# ${utility.title}`,
    `<Chip label="${utility.category}" class="mt-2 mr-2" /> [Source Code](${utility.sourceUrl}) | [Documentation](${utility.docsUrl})`,
  ]

  // see also
  ;(() => {
    const see = utility.frontmatter?.see ?? []

    if (see.length > 0) {
      const seeAlso = `_See also_: ${see
        .map((x) => {
          const parts = x.split('/')
          return `[\`${x}\`](/${parts.map(kebabCase).join('/')}${parts.length === 1 ? '/' : '.html'})`
        })
        .join(' ')}`

      code.push(seeAlso)
    }
  })()

  code.push(`${utility.description}

\`\`\`ts twoslash
  import { ${utility.name} } from 'feathers-utils/${utility.category}';
\`\`\` `)

  if (utility.examples?.length) {
    code.push(`
## ${utility.examples.length > 1 ? 'Examples' : 'Example'}

${utility.examples.join('\n\n')}
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
\`\`\`ts
${utility.dts}
\`\`\` `)
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
