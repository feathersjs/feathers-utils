import type { Utility } from '../utilities'
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
    `[Source Code](${utility.sourceUrl}) | [Documentation](${utility.docsUrl})`,
  ]

  if (utility.frontmatter?.see) {
    const seeAlso = `See also: ${utility.frontmatter.see
      .map((x) => {
        const parts = x.split('/')
        const lastPart = parts.at(-1)
        return `[\`${lastPart}\`](/${parts.map(kebabCase).join('/')}${parts.length === 1 ? '/' : '.html'})`
      })
      .join(' ')}`

    console.log(seeAlso)

    code.push(seeAlso)
  }

  code.push(`${utility.description}

\`\`\`ts twoslash
  import { ${utility.name} } from 'feathers-utils/${utility.category}';
\`\`\` `)

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

  if (utility.examples?.length) {
    code.push(`
## ${utility.examples.length > 1 ? 'Examples' : 'Example'}

${utility.examples.join('\n\n')}
    `)
  }

  code.push(utility.content)

  return code.join('\n\n')
}
