import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
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
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
})
