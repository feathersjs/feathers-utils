import { assert } from 'vitest'
import utilityPage from '../docs/.vitepress/plugins/utility.js'
import type { Utility } from '../docs/.vitepress/utilities.js'

const page = (examples: string[]) =>
  utilityPage(
    {
      name: 'recordHooks',
      title: 'recordHooks',
      description: 'Records what a service was asked to do.',
      category: 'testing',
      tags: [],
      slug: 'record-hooks',
      path: '/testing/record-hooks',
      frontmatter: {},
      content: '',
      args: [],
      examples,
    } as unknown as Utility,
    [],
  )

describe('utility page', () => {
  it('numbers several examples, so each one gets an anchor', () => {
    const markdown = page(['```ts\nfirst()\n```', '```ts\nsecond()\n```'])

    assert.include(markdown, '## Examples')
    assert.include(markdown, '### Example 1\n\n```ts\nfirst()\n```')
    assert.include(markdown, '### Example 2\n\n```ts\nsecond()\n```')
  })

  it('leaves a single example to the section heading', () => {
    const markdown = page(['```ts\nonly()\n```'])

    assert.include(markdown, '## Example\n\n```ts\nonly()\n```')
    assert.notInclude(markdown, '### Example')
  })
})
