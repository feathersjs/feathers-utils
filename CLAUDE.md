# CLAUDE.md

ESM-only (`type: module`) Feathers utility library. All relative imports use the
`.js` extension.

## Entrypoints

Nine barrels, each a package export and a tsdown build entry:
`.` · `./hooks` · `./utils` · `./predicates` · `./resolvers` · `./transformers` · `./guards` · `./helpers` · `./testing`
→ `src/<category>/index.ts`. A new public feature must be re-exported from its
category barrel. `./testing` is test-only code and is deliberately **not** part
of the root barrel, so it cannot end up in a production bundle. `./helpers`
(generic object/path helpers: `getPath`, `setPath`, `isEqual`, …) is not in the
root barrel either — it is not Feathers-specific.

## Feature folder convention

Each public feature is its own **kebab-case** folder under its category, holding
sibling files named `<name>.<kind>.*` where `kind` ∈
`util|hook|predicate|resolver|transformer|guard|helper|testing`:

- `<name>.<kind>.ts` — implementation; the main export is **camelCase**.
- `<name>.<kind>.test.ts` — runtime tests (vitest).
- `<name>.<kind>.test-d.ts` — type-level tests (optional).
- `<name>.<kind>.md` — docs frontmatter (see below).

## Shared internals

- `src/common/` — shared internal helpers, exported via `src/common/index.js`,
  imported as `../../common/index.js`. It also re-exports the public
  `src/helpers/*`, so internal code reaches those through `common` too; a helper
  itself imports sibling files directly (never `common/index.js`) to avoid an
  import cycle. Small ones use in-source tests (`if (import.meta.vitest)`),
  stripped from the build.
- `src/internal.utils.ts` — internal helpers/types, not public API.

## Performance

Hooks and utils run on the **hot path** of every service call, so performance
outranks brevity. Write the plain form:

- **One pass**: a `for` loop that filters, maps and checks in one go — each
  `filter`/`map`/`flatMap` of a chain builds an array of its own.
- Look up in a `Set`/`Map` instead of nesting `some`/`includes` scans.
- Compute what depends only on the options once, in the hook's factory, not
  per call; compare in place (`indexOf`, `isPathWithin`) instead of building
  strings or arrays to compare.
- Copy only the objects you change (`setPath` copies just the objects on its
  path); return the input itself when nothing changed.
- One query per call, not per item (`$in`/`$or`), selecting only the fields
  needed; fetches of a call's items go through `call-fetches.ts`, so hooks
  share them.

## Docs (VitePress)

Auto-discovered from `src/**/*.md`. A page renders the sibling `.ts` file's JSDoc
description, then its `@example`s as `## Example`, then the `.md` body. The JSDoc
is the single source of truth for the intro and the main example — keep
`@example`/`@see` authoritative there. So the `.md` body opens with the first
topic the JSDoc doesn't cover (details, edge cases, migration); an intro or
example written there shows up twice on the page. Frontmatter:

```yaml
---
title: stringifyParams # camelCase export name
category: utils
options: CacheOptions # optional: generates the `## Options` table
see: # optional cross-links
  - hooks/cache
  - utils/gateParams
---
```

- **`see:` references use `category/camelCaseName`** — the camelCase export name,
  NOT the kebab folder/slug (`utils/gateParams`, never `utils/gate-params`).
- **`options:` names an options type** (`type X = { … }` or `interface X { … }`)
  declared in the sibling `.ts` file, or a list of them for a page that documents
  several (each gets a `### TypeName` sub-heading). Every member becomes a card in
  the generated `## Options` section — signature line (name, type, `@default`,
  `required` when the member has no `?`) with the JSDoc description below it, and
  each `@example` in a collapsed details container. **So document options in the
  type, never by hand in the `.md`.** Placement: an `<!-- options -->` marker in the
  body, otherwise after `## Example`. `test/options.test.ts` guards that every
  declared type resolves and that every member reaches the page; the cards are
  styled under `Component: Options` in `docs/.vitepress/style/main.css`.

## Tests

- `vitest`, globals on. Runtime `*.test.ts`; type-level `*.test-d.ts` (typecheck
  enabled in vitest). Coverage thresholds 80%.
- `test/index.test.ts` asserts the **exact** public export surface per entrypoint
  — update its lists when adding/removing an export.
- **Params belong to the caller.** A hook changes them by assigning a new
  `context.params` (`{ ...context.params, query }`); a dot-path write goes
  through `setPath` from `common`, so every nested object on the path is
  copied. Every hook/util test file carries a `does not mutate …` test
  built on `expectNoSideEffects`, imported from `../../testing/index.js` — the
  public `./testing` helper, so the tests use what users get.

## Lint / format

- ESLint (`@feathers-community/eslint-config`) has **Prettier built in as a rule** —
  there is no separate prettier config; run `eslint --fix` to format.
- **No `node:` protocol imports in `src/**/\*.ts`\*\* (lint error; allowed in tests).

## Commands

- `pnpm test` — lint + typecheck + coverage (the full gate).
- `pnpm lint` · `pnpm typecheck` · `pnpm test:unit` · `pnpm build` (tsdown).
