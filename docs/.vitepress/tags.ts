/**
 * The closed tag vocabulary.
 *
 * Tags add an axis that `category` cannot: `category` describes the *shape* of a
 * utility (hook vs. util vs. predicate), while tags describe what it is *for*.
 * Both axes are needed to answer "how do I change the query before it hits the
 * adapter?" — a question that cuts across every category.
 *
 * The vocabulary is deliberately closed and small. Free-form tags across ~90
 * files drift into synonyms (`query` next to `queries`) and into tags that match
 * either almost everything or exactly one entry — useless as a facet either way.
 * `test/tags.test.ts` enforces membership in both directions: no unknown tag on
 * a page, and no tag in here that no page uses.
 *
 * Groups exist for presentation only. A page's `tags` frontmatter is one flat
 * list; the grouping drives chip colors and the order of the filter row.
 */
export type UtilityTagDefinition = {
  /** The tag as written in frontmatter. Lowercase, kebab-case if multi-word. */
  name: string
  /** What earns a page this tag. Shown as the chip's tooltip. */
  description: string
}

export type UtilityTagGroupDefinition = {
  label: string
  description: string
  tags: readonly UtilityTagDefinition[]
}

export const utilityTagGroups = [
  {
    label: 'Context',
    description:
      'Which part of the service call the utility reads or changes. Reflects the primary target — a few utilities legitimately touch more than one.',
    tags: [
      {
        name: 'query',
        description: 'Reads or rewrites `params.query`.',
      },
      {
        name: 'data',
        description:
          'Reads or rewrites `context.data` for create/update/patch.',
      },
      {
        name: 'result',
        description: 'Reads or rewrites `context.result`.',
      },
      {
        name: 'params',
        description:
          'Operates on `params` as a whole, beyond the query — provider, route, pagination, custom keys.',
      },
    ],
  },
  {
    label: 'Topic',
    description: 'What the utility is about.',
    tags: [
      {
        name: 'control-flow',
        description:
          'Decides whether or in which order other hooks run, rather than touching the call itself.',
      },
      {
        name: 'validation',
        description: 'Rejects a call that does not meet a requirement.',
      },
      {
        name: 'authorization',
        description:
          'Restricts what a caller may do or see, based on provider, user, or rate.',
      },
      {
        name: 'multi',
        description:
          'Concerns the `multi` flag or the single-vs-many shape of data and results.',
      },
      {
        name: 'batching',
        description:
          'Splits one logical operation into several service calls, or bundles several into one.',
      },
      {
        name: 'pagination',
        description: 'Concerns `$limit`/`$skip` or the paginated result shape.',
      },
      {
        name: 'relations',
        description: 'Propagates a change to records of another service.',
      },
      {
        name: 'events',
        description: 'Concerns the service events Feathers emits.',
      },
      {
        name: 'caching',
        description: 'Stores and reuses the outcome of a call.',
      },
      {
        name: 'debugging',
        description:
          'Makes a call observable — logging, serializing, inspecting context.',
      },
      {
        name: 'testing',
        description:
          'Written for test code — asserting what a service was asked to do, or awaiting what it does.',
      },
    ],
  },
] as const satisfies readonly UtilityTagGroupDefinition[]

export type UtilityTag =
  (typeof utilityTagGroups)[number]['tags'][number]['name']

export const utilityTags: readonly UtilityTag[] = utilityTagGroups.flatMap(
  (group) => group.tags.map((tag) => tag.name),
)

export const utilityTagDescriptions = Object.fromEntries(
  utilityTagGroups.flatMap((group) =>
    group.tags.map((tag) => [tag.name, tag.description]),
  ),
) as Record<UtilityTag, string>

/** The group label a tag belongs to, used for chip colors. */
export const utilityTagGroupOf = Object.fromEntries(
  utilityTagGroups.flatMap((group) =>
    group.tags.map((tag) => [tag.name, group.label]),
  ),
) as Record<UtilityTag, string>

export const isUtilityTag = (value: unknown): value is UtilityTag =>
  typeof value === 'string' &&
  (utilityTags as readonly string[]).includes(value)
