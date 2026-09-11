import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // scope discovery to the real source trees. Without this, `test.include`
    // falls back to vitest's project-wide default, which only skips
    // `node_modules` and `dist` — so stray checkouts (e.g. git worktrees under
    // `.claude/`) would get their tests and type tests run as well.
    include: ['{src,test}/**/*.test.ts'],
    includeSource: ['src/**/*.{js,ts}'],
    typecheck: {
      enabled: true,
      include: ['{src,test}/**/*.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: [
        '**/*.test.{js,ts}',
        '**/*.test-d.{js,ts}',
        'src/index.ts',
        'src/types.ts',
        'src/resolvers/index.ts',
        'src/resolvers/hooks/index.ts',
        'src/utils/index.ts',
        'src/predicates/index.ts',
        'src/hooks/index.ts',
        'src/guards/index.ts',
        'src/transformers/index.ts',
        'src/testing/index.ts',
        'src/utility-types/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
