# CLAUDE.md

ESM-only (`type: module`) Feathers utility library. All relative imports use the
`.js` extension.

## Entrypoints

Seven barrels, each a package export and a tsdown build entry:
`.` · `./hooks` · `./utils` · `./predicates` · `./resolvers` · `./transformers` · `./guards`
→ `src/<category>/index.ts`. A new public feature must be re-exported from its
category barrel.

## Feature folder convention

Each public feature is its own **kebab-case** folder under its category, holding
sibling files named `<name>.<kind>.*` where `kind` ∈
`util|hook|predicate|resolver|transformer|guard`:

- `<name>.<kind>.ts` — implementation; the main export is **camelCase**.
- `<name>.<kind>.test.ts` — runtime tests (vitest).
- `<name>.<kind>.test-d.ts` — type-level tests (optional).
- `<name>.<kind>.md` — docs frontmatter (see below).

## Shared internals

- `src/common/` — shared helpers, exported via `src/common/index.js`, imported as
  `../../common/index.js`. Small ones use in-source tests (`if (import.meta.vitest)`),
  stripped from the build.
- `src/internal.utils.ts` — internal helpers/types, not public API.

## Docs (VitePress)

Auto-discovered from `src/**/*.md`; the prose body is generated from the sibling
`.ts` file's JSDoc — keep `@example`/`@see` authoritative there. Frontmatter:

```yaml
---
title: stringifyParams   # camelCase export name
category: utils
see:                     # optional cross-links
  - hooks/cache
  - utils/gateParams
---
```

- **`see:` references use `category/camelCaseName`** — the camelCase export name,
  NOT the kebab folder/slug (`utils/gateParams`, never `utils/gate-params`).

## Tests

- `vitest`, globals on. Runtime `*.test.ts`; type-level `*.test-d.ts` (typecheck
  enabled in vitest). Coverage thresholds 80%.
- `test/index.test.ts` asserts the **exact** public export surface per entrypoint
  — update its lists when adding/removing an export.

## Lint / format

- ESLint (`@feathers-community/eslint-config`) has **Prettier built in as a rule** —
  there is no separate prettier config; run `eslint --fix` to format.
- **No `node:` protocol imports in `src/**/*.ts`** (lint error; allowed in tests).

## Commands

- `npm test` — lint + typecheck + coverage (the full gate).
- `npm run lint` · `npm run typecheck` · `npm run test:unit` · `npm run build` (tsdown).
