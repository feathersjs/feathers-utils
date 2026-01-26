import { defineConfig } from 'tsdown'
import pkg from './package.json'

export default defineConfig({
  treeshake: true,
  dts: true,
  clean: true,
  sourcemap: true,
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
  },
  transform: {
    define: {
      'import.meta.vitest': 'undefined',
    },
  },
})
