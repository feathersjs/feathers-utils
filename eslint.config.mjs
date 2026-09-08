import config from '@feathers-community/eslint-config'

export default config(
  {
    tsconfig: { path: './tsconfig.eslint.json' },
  },
  // stray checkouts (e.g. git worktrees under `.claude/`) are outside
  // `tsconfig.eslint.json`, so linting them only yields parser errors
  {
    ignores: ['.claude/**'],
  },
  // additional rules for source files
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          // "node:" protocol imports are not supported in some environments
          patterns: [{ regex: '^node:' }],
        },
      ],
    },
  },
)
