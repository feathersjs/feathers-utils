/**
 * The closed category vocabulary: a utility's `category` frontmatter, which is
 * also its entrypoint (`feathers-utils/<category>`) and its docs section.
 *
 * It lives apart from `utilities.ts` because client code needs it, and that
 * module cannot be imported from the browser: it reads the source tree with
 * `fs`, `typescript` and `prettier`, so a value import drags all of that into
 * the client bundle, where Vite stubs the node built-ins out — and the first
 * `createRequire` call from one of them takes the whole page down. Types from
 * `utilities.ts` are safe either way, since they are erased.
 */
export const utilityCategories = [
  'hooks',
  'utils',
  'resolvers',
  'predicates',
  'transformers',
  'guards',
  'testing',
] as const

export type UtilityCategory = (typeof utilityCategories)[number]
