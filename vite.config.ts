import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    includeSource: ['src/**/*.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: [
        '**/*.test.{js,ts}',
        'src/index.ts',
        'src/types.ts',
        'src/resolvers/index.ts',
        'src/resolvers/hooks/index.ts',
        'src/utils/index.ts',
        'src/predicates/index.ts',
        'src/hooks/index.ts',
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
