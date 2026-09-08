import path from 'node:path'
import type { Plugin } from 'vite'

import { discoverUtilities, type Utility } from '../utilities'
import md from './utility'

export type MarkdownTransformOptions = {
  vitepressDirectory: string
}

export function MarkdownTransform(options: MarkdownTransformOptions): Plugin {
  const { vitepressDirectory } = options

  const sourceDirectory = path.resolve('src')

  // kept as the pending promise (not the resolved list), so a `transform` that
  // is triggered by a re-discovery waits for it instead of racing it.
  let utilitiesList: Promise<Utility[]> = Promise.resolve([])
  let sourceFilePaths = new Set<string>()

  // a page is generated from its frontmatter (`src/**/*.md`) and the JSDoc of
  // the sibling implementation (`sourceFilePath`)
  const isPageSource = (file: string) =>
    sourceFilePaths.has(file) ||
    (file.endsWith('.md') && file.startsWith(sourceDirectory))

  const discover = () => {
    utilitiesList = discoverUtilities()

    void utilitiesList.then((utilities) => {
      sourceFilePaths = new Set(utilities.map((x) => x.sourceFilePath))
    })

    return utilitiesList
  }

  return {
    name: 'feathers-commons-md-transform',
    enforce: 'pre',
    async buildStart() {
      await discover()
    },
    configureServer(server) {
      // The pages are generated from files that are no modules of their own,
      // so `transform` registers them via `addWatchFile`. The discovered data
      // is cached though, and has to be re-discovered for the invalidated page
      // to be transformed with the change. Synchronous on purpose: the pending
      // promise has to be in place before the page is transformed again.
      const onChange = (file: string) => {
        if (!isPageSource(file)) {
          return
        }

        discover()
      }

      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },
    async transform(code, id) {
      if (!id.match(/\.md\b/)) return null

      const slug = id.replace(vitepressDirectory, '')

      const utilities = await utilitiesList

      const utility = utilities.find((x) => x.pathMd === slug)
      if (!utility) {
        return null
      }

      // the page is generated from the `.md` under `src` and the JSDoc of its
      // sibling `.ts` file, so a change there has to invalidate this module
      this.addWatchFile(utility.mdFilePath)
      this.addWatchFile(utility.sourceFilePath)

      const result = md(utility, utilities)

      return result
    },
  }
}
