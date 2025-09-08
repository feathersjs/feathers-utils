import { defineConfig } from 'tsup'

export default defineConfig({
  treeshake: true,
  define: {
    'import.meta.vitest': 'false',
  },
  dts: true,
  clean: true,
  sourcemap: true,
  format: ['esm'],
  entry: {
    index: 'src/index.ts',
    hooks: 'src/hooks/index.ts',
    utils: 'src/utils/index.ts',
    predicates: 'src/predicates/index.ts',
    resolvers: 'src/resolvers/index.ts',
    transformers: 'src/transformers/index.ts',
  },
})
