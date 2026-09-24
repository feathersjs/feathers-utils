import { defineConfig } from 'tsdown'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  treeshake: true,
  dts: true,
  clean: true,
  sourcemap: false,
  format: ['esm'],
  external: [
    ...Object.keys(pkg.peerDependencies || {}),
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    /^node:.+$/,
  ],
  entry: {
    index: 'src/index.ts',
    hooks: 'src/hooks/index.ts',
    utils: 'src/utils/index.ts',
    predicates: 'src/predicates/index.ts',
    resolvers: 'src/resolvers/index.ts',
    transformers: 'src/transformers/index.ts',
    guards: 'src/guards/index.ts',
    testing: 'src/testing/index.ts',
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  outputOptions: {
    // JSDoc already ships in the `.d.mts` files, where editors read it
    comments: { legal: true, annotation: true, jsdoc: false },
  },
})
