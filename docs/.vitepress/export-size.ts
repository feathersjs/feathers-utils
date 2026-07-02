import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { build } from 'esbuild'
import type { Utility, UtilityCategory } from './utilities'

export type BundleSize = {
  /** Minified byte size of the export's own code (deps excluded). */
  minified: number
  /** Gzipped byte size (level 9) of the minified output. */
  gzip: number
}

const distDir = path.resolve(import.meta.dirname, '../../dist')

// Memoized across the many discoverUtilities() calls (config load, each data
// loader, each *.paths.ts, markdownTransform). Invalidated when dist changes.
let cache: Map<string, BundleSize> | null = null
let cacheKey = ''

const keyOf = (category: UtilityCategory, name: string) => `${category}/${name}`

/** Newest mtime across the dist barrels + chunks, used as a cache key. */
async function distSignature(): Promise<string | null> {
  let files: string[]
  try {
    files = (await fs.readdir(distDir)).filter((f) => f.endsWith('.mjs'))
  } catch {
    return null // dist/ missing → measurement unavailable
  }
  if (!files.length) return null

  let newest = 0
  for (const file of files) {
    const { mtimeMs } = await fs.stat(path.join(distDir, file))
    if (mtimeMs > newest) newest = mtimeMs
  }
  return `${newest}:${files.length}`
}

/**
 * Measures each utility's own-code bundle size (min + gzip) by re-bundling a
 * single named export from its published dist barrel. npm dependencies are
 * marked external (`packages: 'external'`), so only the util's own transitive
 * lib code is counted — matching tsdown's externals and VueUse's semantics.
 */
async function computeSizes(
  utilities: Utility[],
): Promise<Map<string, BundleSize>> {
  const result = new Map<string, BundleSize>()

  await Promise.all(
    utilities.map(async (utility) => {
      const barrel = path.join(distDir, `${utility.category}.mjs`)
      try {
        const out = await build({
          stdin: {
            contents: `export { ${utility.name} } from ${JSON.stringify(barrel)}`,
            resolveDir: distDir,
            loader: 'js',
          },
          bundle: true,
          format: 'esm',
          platform: 'neutral',
          minify: true,
          treeShaking: true,
          packages: 'external',
          write: false,
          legalComments: 'none',
        })
        const code = out.outputFiles[0].contents
        result.set(keyOf(utility.category, utility.name), {
          minified: code.byteLength,
          gzip: zlib.gzipSync(code, { level: 9 }).byteLength,
        })
      } catch {
        // Export not found in barrel / bundling failed → skip this one.
      }
    }),
  )

  return result
}

/**
 * Attaches `bundleSize` to each utility in-place. No-op (leaves `bundleSize`
 * undefined) when `dist/` is missing, so `docs:dev` works without a prior build.
 */
export async function attachExportSizes(utilities: Utility[]): Promise<void> {
  const signature = await distSignature()
  if (!signature) return

  if (!cache || cacheKey !== signature) {
    cache = await computeSizes(utilities)
    cacheKey = signature
  }

  for (const utility of utilities) {
    utility.bundleSize = cache.get(keyOf(utility.category, utility.name))
  }
}
