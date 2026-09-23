import utilityMarkdown from '../docs/.vitepress/plugins/utility.js'
import {
  discoverUtilities,
  type Utility,
} from '../docs/.vitepress/utilities.js'

/**
 * A page's options table is generated from the type named in its `options`
 * frontmatter, so the documented options can never drift from the type. These
 * assertions guard the two ways that can silently break: the frontmatter
 * pointing at a type that no longer exists (the table disappears), and a member
 * of the type not making it onto the page.
 */

let utilities: Utility[]
let documented: Utility[]

beforeAll(async () => {
  utilities = await discoverUtilities()
  documented = utilities.filter((x) => x.frontmatter.options)
}, 120_000)

describe('generated options tables', () => {
  it('has pages that document their options', () => {
    expect(documented.length).toBeGreaterThan(0)
  })

  it('resolves every `options` frontmatter to a type in the sibling source file', () => {
    const unresolved = documented.flatMap((utility) => {
      const declared: string[] = [utility.frontmatter.options].flat()
      const found = (utility.options ?? []).map((group) => group.type)

      return declared
        .filter((typeName) => !found.includes(typeName))
        .map((typeName) => `${utility.pathMd}: ${typeName}`)
    })

    expect(unresolved).toEqual([])
  })

  it('renders every member of the type as its own block', () => {
    for (const utility of documented) {
      const page = utilityMarkdown(utility, utilities)

      for (const group of utility.options!) {
        for (const option of group.members) {
          expect(page, `${utility.pathMd} / ${option.name}`).toContain(
            `<span class="option-name">${option.name}</span>`,
          )
        }
      }
    }
  })

  it('places the table where the page marks it, and leaves no marker behind', () => {
    for (const utility of documented) {
      const page = utilityMarkdown(utility, utilities)

      expect(page, utility.pathMd).not.toContain('<!-- options -->')
      expect(page, utility.pathMd).toContain('## Options')
    }
  })

  it('reads type, optionality, `@default` and `@example` from the source', () => {
    const cache = utilities.find((x) => x.name === 'cache')!
    const [group] = cache.options!
    const byName = Object.fromEntries(group.members.map((x) => [x.name, x]))

    expect(group.type).toBe('CacheOptions')

    expect(Object.keys(byName)).toEqual([
      'map',
      'id',
      'scope',
      'transformParams',
      'serialize',
      'logger',
      'clone',
      'iff',
    ])

    expect(byName.map).toMatchObject({ type: 'Cache', optional: false })
    expect(byName.id).toMatchObject({
      type: 'string',
      optional: true,
      default: "service.options.id ?? 'id'",
    })
    expect(byName.clone.default).toBe('true')
    expect(byName.transformParams.examples?.[0]).toContain('gateParams')
  })

  it('escapes a type that would otherwise be read as markup', () => {
    const cache = utilities.find((x) => x.name === 'cache')!
    const page = utilityMarkdown(cache, utilities)

    // `clone` is `boolean | (<T>(value: T) => T)` — an unescaped `<T>` would be
    // swallowed as an (unknown) HTML tag, and Vue would fail to compile the page
    expect(page).toContain(
      '<span class="option-type">boolean | (&lt;T&gt;(value: T) =&gt; T)</span>',
    )
  })

  it('marks a required option and shows a documented default', () => {
    const cache = utilities.find((x) => x.name === 'cache')!
    const page = utilityMarkdown(cache, utilities)

    expect(page).toContain('<span class="option-required">required</span>')
    expect(page).toContain(
      '<span class="option-default"><span class="option-label">default</span>true</span>',
    )
  })

  it('resolves `{@link}` in an option description', () => {
    const cache = utilities.find((x) => x.name === 'cache')!
    const page = utilityMarkdown(cache, utilities)

    expect(page).toContain('[`gateParams`](/utils/gate-params)')
  })

  it('indexes the options of a page for search', () => {
    const cache = utilities.find((x) => x.name === 'cache')!
    const indexed = utilityMarkdown(cache, utilities, { target: 'search' })

    expect(indexed).toContain('`serialize`')
    // the card markup carries no text of its own
    expect(indexed).not.toContain('option-name')
    // the details container is a page affordance, the example text is what the
    // index is after
    expect(indexed).not.toContain('::: details')
    expect(indexed).toContain('createHash')
  })

  it('gives a page that documents two types a heading per type', () => {
    const recordHooks = utilities.find((x) => x.name === 'recordHooks')!
    const page = utilityMarkdown(recordHooks, utilities)

    expect(recordHooks.options!.map((x) => x.type)).toEqual([
      'RecordHooksOptions',
      'RecordedHooksWaitOptions',
    ])
    expect(page).toContain('### `RecordHooksOptions`')
    expect(page).toContain('### `RecordedHooksWaitOptions`')
  })

  it('leaves a page without `options` frontmatter alone', () => {
    const plain = utilities.find((x) => !x.frontmatter.options)!

    expect(plain.options).toBeUndefined()
    expect(utilityMarkdown(plain, utilities)).not.toContain('## Options')
  })
})
